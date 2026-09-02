/**
 * Home-quote adapter — LANDING PAGE ONLY.
 *
 * Bridges the live (or fallback) public pricing config into the result
 * shape the home page JSX expects — `distanceMiles`, `estimatedPrice`,
 * `feesBreakdown.{baseFare, flatMilesAllowance, billedMiles, perMileRate,
 * distanceCharge, total}`, and a `formula` block for the human-readable
 * "Flat rate: $X covers the first Y miles, then $Z/mile" description.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LANDING-PAGE CONTRACT — ALWAYS FLAT-RATE
 * ─────────────────────────────────────────────────────────────────────
 *
 * The public landing page ALWAYS advertises flat-rate pricing:
 *
 *     total = baseFee + max(0, miles − flatMiles) × perMileRate
 *
 * It NEVER shows tiered / CATEGORY_ABC pricing, even if the admin has
 * switched the active default config to tiered mode. The backend
 * `getPublicDefaultPricingConfig()` enforces this by returning `null`
 * for CATEGORY_ABC configs (so this adapter falls back to
 * HOME_FLAT_QUOTE_CONFIG). This adapter ALSO defensively enforces it:
 * if a CATEGORY_ABC config somehow reaches the frontend, it is treated
 * as `null` (i.e. fall back to the hard-coded flat constants).
 *
 * This constraint applies ONLY to the landing page. Other system
 * surfaces (admin preview, actual delivery quotes, etc.) continue to
 * honor whatever pricing mode the admin configured.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Why an adapter (and not just calling `calculatePricing` directly)?
 * ─────────────────────────────────────────────────────────────────────
 *   1. The shared `calculatePricing` returns the FULL quote shape
 *      (including driver payout, transaction-fee breakdown, ABC bands,
 *      etc.). The home page only renders a flat-rate-style summary, so
 *      we project the shared result down to what the JSX actually uses.
 *   2. The home page's empty-state UI advertises the policy line
 *      "Flat rate: $X covers the first Y miles, then $Z/mile" — that
 *      string is built HERE so it pulls from the live config, not from
 *      a hard-coded constant.
 *   3. The adapter accepts either a live `PublicPricingConfig` (from
 *      the public API) OR `null` (in which case it falls back to the
 *      hard-coded `HOME_FLAT_QUOTE_CONFIG`). This keeps the home page
 *      resilient to backend outages while still preferring live data
 *      when it's available.
 *
 * This module does NOT re-implement the pricing math — it delegates to
 * `calculatePricing` (the single source of truth on the frontend) and
 * only reshapes the output.
 */

import {
  calculatePricing,
  type PricingCalcConfig,
} from './calculate';
import {
  HOME_FLAT_QUOTE_CONFIG,
  type HomeFlatQuoteResult,
} from './home-flat-quote';
import type { PublicPricingConfig } from '@/types/publicPricing';

/**
 * The home page's quote-result shape — same as `HomeFlatQuoteResult`
 * (kept for backward compat with the existing JSX).
 */
export type HomeQuoteResult = HomeFlatQuoteResult;

/**
 * Resolve the live config to a flat-rate-only shape.
 *
 * Returns `null` when:
 *   - The input is `null` (backend has no config, or endpoint failed), OR
 *   - The input is `CATEGORY_ABC` (landing page never shows tiered).
 *
 * In both cases the caller falls back to HOME_FLAT_QUOTE_CONFIG.
 */
function liveConfigOrNull(
  pub: PublicPricingConfig | null,
): PublicPricingConfig | null {
  if (!pub) return null;
  // Landing-page contract: never use CATEGORY_ABC. If the backend
  // returned one (shouldn't happen — backend returns null for ABC —
  // but defensive), treat it as no config and fall back.
  if (pub.pricingMode === 'CATEGORY_ABC') return null;
  return pub;
}

/**
 * Convert a flat-rate `PublicPricingConfig` (PER_MILE only) into the
 * `PricingCalcConfig` shape the shared `calculatePricing` expects.
 *
 * The shared util requires a few fields the public endpoint doesn't
 * expose (id, driverSharePct, tiers). We supply neutral defaults so
 * the calc never throws on missing fields — `driverSharePct` doesn't
 * affect the customer-facing `estimatedPrice` (only the driver payout,
 * which the home page doesn't render).
 *
 * If `flatMiles` or `perMileRate` is null on the live config (which
 * would only happen for a misconfigured PER_MILE config), fall back to
 * the hard-coded HOME_FLAT_QUOTE_CONFIG values so the calc still works.
 */
function flatConfigToCalcConfig(
  pub: PublicPricingConfig,
): PricingCalcConfig {
  return {
    id: 'public-default',
    pricingMode: 'PER_MILE',
    baseFee: pub.baseFee,
    flatMiles: pub.flatMiles ?? HOME_FLAT_QUOTE_CONFIG.flatMiles,
    perMileRate: pub.perMileRate ?? HOME_FLAT_QUOTE_CONFIG.perMileRate,
    insuranceFee: pub.insuranceFee,
    transactionFeePct: pub.transactionFeePct,
    transactionFeeFixed: pub.transactionFeeFixed,
    feePassThrough: pub.feePassThrough,
    // driverSharePct doesn't affect the customer-facing total; pick a
    // neutral default so the calc doesn't throw on a missing field.
    driverSharePct: 60,
    tiers: [],
    categoryRules: [],
  };
}

/**
 * Build a `PricingCalcConfig` from the hard-coded fallback values —
 * used when the public endpoint returns null or fails, OR when the
 * live config is CATEGORY_ABC (landing page stays flat).
 */
function fallbackConfigToCalcConfig(): PricingCalcConfig {
  return {
    id: 'fallback',
    pricingMode: 'PER_MILE',
    baseFee: HOME_FLAT_QUOTE_CONFIG.baseFee,
    flatMiles: HOME_FLAT_QUOTE_CONFIG.flatMiles,
    perMileRate: HOME_FLAT_QUOTE_CONFIG.perMileRate,
    insuranceFee: 0,
    transactionFeePct: null,
    transactionFeeFixed: null,
    feePassThrough: false,
    driverSharePct: 60,
    tiers: [],
    categoryRules: [],
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Build the human-readable `formula` block from the flat-rate config
 * + the actual distance quoted.
 *
 *   description: "Flat rate: $X covers the first Y miles, then $Z per additional mile."
 *   expression:  "$X + max(0, 50 − Y) × $Z = $146.00"
 *   label:       "Flat Rate"
 *
 * The description string is what the empty-state JSX renders under the
 * "Service Price" heading before the user enters addresses — so it has
 * to advertise the policy using LIVE values, not the hard-coded ones.
 */
function buildFlatFormulaBlock(opts: {
  baseFee: number;
  flatMiles: number;
  perMileRate: number;
  miles: number;
  total: number;
}): HomeQuoteResult['formula'] {
  const { baseFee, flatMiles, perMileRate, miles, total } = opts;
  return {
    description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile.`,
    expression: `$${baseFee} + max(0, ${miles} − ${flatMiles}) × $${perMileRate.toFixed(2)} = $${total.toFixed(2)}`,
    label: 'Flat Rate',
  };
}

/**
 * Calculate the home-page quote using either the live public pricing
 * config (PER_MILE only) or the hard-coded fallback.
 *
 * @param distanceMiles  Driving distance in miles. Decimals allowed;
 *                        rounded to nearest whole mile for display.
 * @param liveConfig     The live `PublicPricingConfig` from
 *                        `usePublicDefaultPricing`, or `null` to use the
 *                        hard-coded fallback.
 *                        If a CATEGORY_ABC config is passed, it is
 *                        treated as `null` (landing page stays flat).
 */
export function calculateHomeQuote(
  distanceMiles: number,
  liveConfig: PublicPricingConfig | null,
): HomeQuoteResult {
  if (typeof distanceMiles !== 'number' || !Number.isFinite(distanceMiles)) {
    throw new Error(
      `calculateHomeQuote: distanceMiles must be a finite number (got ${String(distanceMiles)})`,
    );
  }
  if (distanceMiles < 0) {
    throw new Error(
      `calculateHomeQuote: distanceMiles must be >= 0 (got ${distanceMiles})`,
    );
  }

  // Round to nearest whole mile for display reconciliation.
  const miles = Math.round(distanceMiles);

  const flatLive = liveConfigOrNull(liveConfig);
  const calcConfig: PricingCalcConfig = flatLive
    ? flatConfigToCalcConfig(flatLive)
    : fallbackConfigToCalcConfig();

  // Delegate the math to the shared util (single source of truth).
  // calculatePricing in PER_MILE mode is the same flat-rate formula
  // the legacy calculateHomeFlatQuote used — verified by home-quote.test.ts.
  const calc = calculatePricing({
    config: calcConfig,
    distanceMiles: miles,
  });

  // ─── Project the shared result into the home page's expected shape ───
  const flatMilesAllowance = calc.feesBreakdown.flatMilesAllowance ?? 0;
  const billedMiles = calc.feesBreakdown.billedMiles ?? 0;
  const perMileRate = calcConfig.perMileRate ?? HOME_FLAT_QUOTE_CONFIG.perMileRate;
  const baseFare = calc.feesBreakdown.baseFare;
  const distanceCharge = calc.feesBreakdown.distanceCharge;
  const total = calc.estimatedPrice;

  return {
    distanceMiles: miles,
    estimatedPrice: round2(total),
    feesBreakdown: {
      baseFare: round2(baseFare),
      flatMilesAllowance,
      billedMiles,
      perMileRate,
      distanceCharge: round2(distanceCharge),
      total: round2(total),
    },
    formula: buildFlatFormulaBlock({
      baseFee: calcConfig.baseFee,
      flatMiles: calcConfig.flatMiles ?? 0,
      perMileRate,
      miles,
      total,
    }),
  };
}

/**
 * The advertised rate summary for the empty-state UI and JSON-LD.
 *
 * Returns the LIVE values when a flat-rate (PER_MILE) config is
 * supplied, otherwise the hard-coded fallback. Used in two places:
 *   1. The "Service Price" empty-state subtitle on the home page
 *      ("Flat-rate pricing: $X covers the first Y miles, then $Z/mile…")
 *   2. The JSON-LD `Offer.description` structured-data string.
 *
 * Both of those used to be hard-coded — this helper centralizes the
 * "advertise the current rate" string so admin changes propagate
 * everywhere.
 *
 * NOTE: If a CATEGORY_ABC config is passed, it is treated as `null`
 * (landing page always advertises flat-rate, never tiered).
 */
export function getAdvertisedRateSummary(
  liveConfig: PublicPricingConfig | null,
): {
  baseFee: number;
  flatMiles: number;
  perMileRate: number;
  description: string;
} {
  const flatLive = liveConfigOrNull(liveConfig);

  if (flatLive && flatLive.pricingMode === 'PER_MILE') {
    const baseFee = flatLive.baseFee;
    // Defensive: a misconfigured PER_MILE config could have null
    // flatMiles/perMileRate. Fall back to hard-coded values.
    const flatMiles = flatLive.flatMiles ?? HOME_FLAT_QUOTE_CONFIG.flatMiles;
    const perMileRate = flatLive.perMileRate ?? HOME_FLAT_QUOTE_CONFIG.perMileRate;
    return {
      baseFee,
      flatMiles,
      perMileRate,
      description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile. Insurance and transaction fees included.`,
    };
  }

  // Fallback — hard-coded advertised rate. Reached when:
  //   - liveConfig is null (endpoint returned null or failed), OR
  //   - liveConfig is CATEGORY_ABC (landing page stays flat), OR
  //   - liveConfig has an unknown pricing mode (defensive).
  const { baseFee, flatMiles, perMileRate } = HOME_FLAT_QUOTE_CONFIG;
  return {
    baseFee,
    flatMiles,
    perMileRate,
    description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile. Insurance and transaction fees included.`,
  };
}

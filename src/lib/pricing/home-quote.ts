/**
 * Home-quote adapter.
 *
 * Bridges the live (or fallback) public pricing config into the result
 * shape the home page JSX expects — `distanceMiles`, `estimatedPrice`,
 * `feesBreakdown.{baseFare, flatMilesAllowance, billedMiles, perMileRate,
 * distanceCharge, total}`, and a `formula` block for the human-readable
 * "Flat rate: $X covers the first Y miles, then $Z/mile" description.
 *
 * Why an adapter (and not just calling `calculatePricing` directly)?
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
  type PricingMode,
} from './calculate';
import {
  HOME_FLAT_QUOTE_CONFIG,
  type HomeFlatQuoteResult,
} from './home-flat-quote';
import type {
  PublicPricingConfig,
  PublicPricingMode,
} from '@/types/publicPricing';

/**
 * The home page's quote-result shape — same as `HomeFlatQuoteResult`
 * (kept for backward compat with the existing JSX) but the `formula`
 * block adapts to the active pricing mode.
 */
export type HomeQuoteResult = HomeFlatQuoteResult;

/**
 * Convert a `PublicPricingConfig` (from the public API) into the
 * `PricingCalcConfig` shape the shared `calculatePricing` expects.
 *
 * The shared util requires a few fields the public endpoint doesn't
 * expose (id, driverSharePct, tiers). We supply neutral defaults so
 * the calc never throws on missing fields — `driverSharePct` doesn't
 * affect the customer-facing `estimatedPrice` (only the driver payout,
 * which the home page doesn't render).
 */
function publicConfigToCalcConfig(
  pub: PublicPricingConfig,
): PricingCalcConfig {
  // Legacy FLAT_TIER is treated as PER_MILE everywhere — never let it
  // leak through to the calc util.
  const safeMode: PricingMode =
    pub.pricingMode === 'CATEGORY_ABC' ? 'CATEGORY_ABC' : 'PER_MILE';

  return {
    id: 'public-default',
    pricingMode: safeMode,
    baseFee: pub.baseFee,
    flatMiles: pub.flatMiles,
    perMileRate: pub.perMileRate,
    insuranceFee: pub.insuranceFee,
    transactionFeePct: pub.transactionFeePct,
    transactionFeeFixed: pub.transactionFeeFixed,
    feePassThrough: pub.feePassThrough,
    // driverSharePct doesn't affect the customer-facing total; pick a
    // neutral default so the calc doesn't throw on a missing field.
    driverSharePct: 60,
    tiers: [],
    categoryRules:
      safeMode === 'CATEGORY_ABC'
        ? pub.tierBands.map((b) => ({
            category: (['A', 'B', 'C'].includes(b.category)
              ? b.category
              : 'A') as 'A' | 'B' | 'C',
            minMiles: b.minMiles,
            maxMiles: b.maxMiles,
            baseFee: null,
            flatPrice: null,
            perMileRate: b.perMileRate,
          }))
        : [],
  };
}

/**
 * Build a `PricingCalcConfig` from the hard-coded fallback values —
 * used when the public endpoint returns null or fails.
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
 * Build the human-readable `formula` block from the live (or fallback)
 * config + the actual distance quoted.
 *
 * In PER_MILE mode:
 *   description: "Flat rate: $X covers the first Y miles, then $Z per additional mile."
 *   expression:  "$X + max(0, 50 − Y) × $Z = $146.00"
 *   label:       "Flat Rate"
 *
 * In CATEGORY_ABC mode (tiered):
 *   description: "Tiered rate: $X base + per-mile bands (A / B / C)."
 *   expression:  "See breakdown"
 *   label:       "Tiered Rate"
 *
 * The description string is what the empty-state JSX renders under the
 * "Service Price" heading before the user enters addresses — so it has
 * to advertise the policy using LIVE values, not the hard-coded ones.
 */
function buildFormulaBlock(opts: {
  pricingMode: PublicPricingMode;
  baseFee: number;
  flatMiles: number | null;
  perMileRate: number | null;
  miles: number;
  total: number;
}): HomeQuoteResult['formula'] {
  if (opts.pricingMode === 'PER_MILE') {
    const baseFee = opts.baseFee;
    const flatMiles = opts.flatMiles ?? 0;
    const perMileRate = opts.perMileRate ?? 0;
    return {
      description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile.`,
      expression: `$${baseFee} + max(0, ${opts.miles} − ${flatMiles}) × $${perMileRate.toFixed(2)} = $${opts.total.toFixed(2)}`,
      label: 'Flat Rate',
    };
  }

  // CATEGORY_ABC — the home page doesn't render the per-band breakdown,
  // so we just advertise that it's tiered and let the price speak for
  // itself.
  return {
    description: `Tiered rate: $${opts.baseFee} base + per-mile bands (see breakdown).`,
    expression: `$${opts.total.toFixed(2)} for ${opts.miles} mi`,
    label: 'Tiered Rate',
  };
}

/**
 * Calculate the home-page quote using either the live public pricing
 * config or the hard-coded fallback.
 *
 * @param distanceMiles  Driving distance in miles. Decimals allowed;
 *                        rounded to nearest whole mile for display.
 * @param liveConfig     The live `PublicPricingConfig` from
 *                        `usePublicDefaultPricing`, or `null` to use the
 *                        hard-coded fallback.
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

  const calcConfig: PricingCalcConfig = liveConfig
    ? publicConfigToCalcConfig(liveConfig)
    : fallbackConfigToCalcConfig();

  // Delegate the math to the shared util (single source of truth).
  const calc = calculatePricing({
    config: calcConfig,
    distanceMiles: miles,
  });

  // ─── Project the shared result into the home page's expected shape ───
  // In PER_MILE mode the shared util always sets `flatMilesAllowance`
  // and `billedMiles`. In CATEGORY_ABC mode it doesn't — fall back to
  // 0 / undefined so the JSX still renders (the "Extra miles" row will
  // just show 0 mi × $0.00, which is fine for tiered display).
  const flatMilesAllowance = calc.feesBreakdown.flatMilesAllowance ?? 0;
  const billedMiles = calc.feesBreakdown.billedMiles ?? 0;

  // In PER_MILE mode, `perMileRate` is the config's perMileRate. In
  // CATEGORY_ABC mode, the "rate" varies by band — the home page
  // doesn't render a single rate, but the JSX still references
  // `feesBreakdown.perMileRate`, so we surface the FIRST band's rate
  // (which is typically the "starting rate" the admin would advertise).
  const perMileRate =
    liveConfig?.pricingMode === 'PER_MILE'
      ? (liveConfig.perMileRate ?? 0)
      : liveConfig?.pricingMode === 'CATEGORY_ABC' && liveConfig.tierBands.length > 0
        ? (liveConfig.tierBands[0].perMileRate ?? 0)
        : HOME_FLAT_QUOTE_CONFIG.perMileRate;

  const baseFare = calc.feesBreakdown.baseFare;
  const distanceCharge = calc.feesBreakdown.distanceCharge;
  const total = calc.estimatedPrice;

  const effectiveMode: PublicPricingMode =
    (calcConfig.pricingMode === 'CATEGORY_ABC' ? 'CATEGORY_ABC' : 'PER_MILE');

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
    formula: buildFormulaBlock({
      pricingMode: effectiveMode,
      baseFee: calcConfig.baseFee,
      flatMiles: calcConfig.flatMiles,
      perMileRate: calcConfig.perMileRate,
      miles,
      total,
    }),
  };
}

/**
 * The advertised rate summary for the empty-state UI and JSON-LD.
 *
 * Returns the LIVE values when a config is supplied, otherwise the
 * hard-coded fallback. Used in two places:
 *   1. The "Service Price" empty-state subtitle on the home page
 *      ("Flat-rate pricing: $X covers the first Y miles, then $Z/mile…")
 *   2. The JSON-LD `Offer.description` structured-data string.
 *
 * Both of those used to be hard-coded — this helper centralizes the
 * "advertise the current rate" string so admin changes propagate
 * everywhere.
 */
export function getAdvertisedRateSummary(
  liveConfig: PublicPricingConfig | null,
): {
  baseFee: number;
  flatMiles: number;
  perMileRate: number;
  description: string;
} {
  if (liveConfig?.pricingMode === 'PER_MILE') {
    const baseFee = liveConfig.baseFee;
    const flatMiles = liveConfig.flatMiles ?? 0;
    const perMileRate = liveConfig.perMileRate ?? 0;
    return {
      baseFee,
      flatMiles,
      perMileRate,
      description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile. Insurance and transaction fees included.`,
    };
  }

  if (liveConfig?.pricingMode === 'CATEGORY_ABC') {
    const baseFee = liveConfig.baseFee;
    return {
      baseFee,
      flatMiles: 0,
      perMileRate: 0,
      description: `Tiered rate: $${baseFee} base + per-mile bands. Insurance and transaction fees included.`,
    };
  }

  // Fallback — hard-coded advertised rate (kept here so a backend
  // outage doesn't break the home page's SEO/empty-state copy).
  const { baseFee, flatMiles, perMileRate } = HOME_FLAT_QUOTE_CONFIG;
  return {
    baseFee,
    flatMiles,
    perMileRate,
    description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile. Insurance and transaction fees included.`,
  };
}

/**
 * Flat-rate pricing calculator for the public home page quote widget.
 *
 * This module is intentionally DECOUPLED from the main pricing engine
 * (src/lib/pricing/calculate.ts) and from the backend's
 * `/api/deliveryRequests/individual/quote-preview` endpoint.
 *
 * The home page shows prospective customers a simple, transparent
 * flat-rate price so they can see exactly what they will pay —
 * WITHOUT depending on any backend pricing configuration, DB state,
 * or authenticated quote-preview endpoint. This keeps the home page
 * quote fast, deterministic, and resilient to backend pricing-mode
 * changes.
 *
 * ────────────────────────────────────────────────────────────────────
 * FORMULA
 * ────────────────────────────────────────────────────────────────────
 *
 *   total = BASE_FEE + max(0, miles − FLAT_MILES) × PER_MILE_RATE
 *
 *   - The first FLAT_MILES miles are covered by the flat BASE_FEE.
 *   - Any mile beyond FLAT_MILES is billed at PER_MILE_RATE.
 *   - No insurance, transaction, or service fees are added on the
 *     home page quote — what the customer sees is what they pay.
 *
 * This is the SAME flat-pricing formula used by the main pricing
 * engine's PER_MILE ("Flat with extra mileage") mode. It is
 * re-implemented here as a small, self-contained module so the
 * home page does not need to load the full pricing config from
 * the backend.
 *
 * ────────────────────────────────────────────────────────────────────
 * USAGE
 * ────────────────────────────────────────────────────────────────────
 *
 *   const result = calculateHomeFlatQuote(50);
 *   // result.estimatedPrice === 146
 *   // result.formula.expression === "$101 + max(0, 50 − 25) × $1.80 = $146.00"
 *
 * The returned `result` object matches the shape the existing
 * homePage.tsx rendering expects (distanceMiles, estimatedPrice,
 * feesBreakdown.baseFare) so it can be dropped in as `quoteResult`.
 */

/**
 * Flat-rate pricing constants used on the public home page.
 *
 * These values are intentionally hardcoded — they represent the
 * public, advertised flat rate for the home page quote widget
 * and should NOT be coupled to any backend pricing config.
 *
 * If the business wants to change the advertised flat rate, change
 * these constants here (and re-deploy the frontend).
 */
export const HOME_FLAT_QUOTE_CONFIG = {
  /** Flat base fee in USD — covers the first FLAT_MILES miles. */
  baseFee: 101,
  /** Distance (in miles) covered by the flat base fee. */
  flatMiles: 25,
  /** Per-mile rate in USD for every mile beyond FLAT_MILES. */
  perMileRate: 1.8,
} as const;

export type HomeFlatQuoteConfig = typeof HOME_FLAT_QUOTE_CONFIG;

/**
 * Result of a flat-rate quote calculation.
 *
 * The top-level fields (distanceMiles, estimatedPrice, feesBreakdown)
 * are shaped to match what the existing homePage.tsx rendering expects,
 * so this object can be assigned directly to `quoteResult` state.
 */
export interface HomeFlatQuoteResult {
  /** Distance used for the calculation, in miles (rounded to nearest mile). */
  distanceMiles: number;
  /** Final customer-facing price (USD). */
  estimatedPrice: number;
  /** Itemized breakdown for the UI. */
  feesBreakdown: {
    /** The flat base fee (USD). */
    baseFare: number;
    /** Number of miles covered by the flat base fee. */
    flatMilesAllowance: number;
    /** Number of miles billed beyond the flat allowance. */
    billedMiles: number;
    /** Per-mile rate applied to billed miles (USD). */
    perMileRate: number;
    /** Charge for the billed miles (USD) = billedMiles × perMileRate. */
    distanceCharge: number;
    /** Final customer-facing total (USD) = baseFare + distanceCharge. */
    total: number;
  };
  /**
   * Human-readable formula description + the substituted expression.
   * The UI renders these so the customer can see exactly how the
   * price was computed.
   */
  formula: {
    /** One-line description of the flat-rate policy. */
    description: string;
    /** The formula with the actual numbers plugged in, e.g.
     *  "$101 + max(0, 50 − 25) × $1.80 = $146.00" */
    expression: string;
    /** Short label for the pricing model (for badges / chips). */
    label: string;
  };
}

/**
 * Round to 2 decimal places — matches the main pricing engine's
 * `Number(x.toFixed(2))` pattern for consistency.
 */
function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Calculate the home-page flat-rate quote for a given driving distance.
 *
 * @param distanceMiles Driving distance in miles (typically from the
 *                      Google Directions API). Decimals are allowed;
 *                      the value is rounded to the nearest whole mile
 *                      so the customer-facing math always reconciles
 *                      with the displayed "X miles" badge.
 * @throws {Error} if distanceMiles is negative, NaN, or not finite.
 */
export function calculateHomeFlatQuote(distanceMiles: number): HomeFlatQuoteResult {
  if (typeof distanceMiles !== 'number' || !Number.isFinite(distanceMiles)) {
    throw new Error(
      `calculateHomeFlatQuote: distanceMiles must be a finite number (got ${String(distanceMiles)})`
    );
  }
  if (distanceMiles < 0) {
    throw new Error(
      `calculateHomeFlatQuote: distanceMiles must be >= 0 (got ${distanceMiles})`
    );
  }

  const { baseFee, flatMiles, perMileRate } = HOME_FLAT_QUOTE_CONFIG;

  // Round to nearest whole mile so the displayed math reconciles
  // with the "X miles" badge (which also shows Math.round(distanceMiles)).
  const miles = Math.round(distanceMiles);

  const billedMiles = Math.max(0, miles - flatMiles);
  const baseFare = round2(baseFee);
  const distanceCharge = round2(billedMiles * perMileRate);
  const total = round2(baseFare + distanceCharge);

  return {
    distanceMiles: miles,
    estimatedPrice: total,
    feesBreakdown: {
      baseFare,
      flatMilesAllowance: flatMiles,
      billedMiles,
      perMileRate,
      distanceCharge,
      total,
    },
    formula: {
      description: `Flat rate: $${baseFee} covers the first ${flatMiles} miles, then $${perMileRate.toFixed(2)} per additional mile.`,
      expression: `$${baseFee} + max(0, ${miles} − ${flatMiles}) × $${perMileRate.toFixed(2)} = $${total.toFixed(2)}`,
      label: 'Flat Rate',
    },
  };
}

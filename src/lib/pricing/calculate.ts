/**
 * Shared pricing calculation utility.
 *
 * This is the SINGLE SOURCE OF TRUTH for pricing math on the frontend.
 * It mirrors the backend `PricingEngineService.calculateQuote` in
 * backend/src/delivery-logistics/pricing-engine.service.ts exactly —
 * same formulas, same rounding (Number(x.toFixed(2))), same mode
 * resolution, same mileage-category boundaries (read from DB categoryRules).
 *
 * Used by:
 *   - PricingConfigForm "Quote Preview" panel (Item 10)
 *   - admin-user-detail "Preview a Quote" dialog (Item 9)
 *   - Anywhere else a live quote preview is needed
 *
 * The backend remains authoritative for persisted quotes; this utility
 * is for live preview only. Keep the two implementations in sync — if
 * you change one, change the other.
 *
 * ────────────────────────────────────────────────────────────────────
 * SUPPORTED PRICING MODELS (only two — FLAT_TIER is DEPRECATED)
 * ────────────────────────────────────────────────────────────────────
 *
 * 1. ABC (progressive tiered, schema name CATEGORY_ABC)
 *      total = baseFee + Σ (miles_in_band_i × rate_i)
 *    where bands are the categoryRules rows sorted by minMiles.
 *    Each band contributes: max(0, min(miles, maxMiles ?? ∞) - prevBandMax) × perMileRate
 *    (where prevBandMax starts at 0 and is set to each band's maxMiles after it's processed,
 *    so the bands are always contiguous regardless of the minMiles values the admin enters.)
 *
 *    Example (baseFee=50, A: 0-25 @ $2.00, B: 25-50 @ $1.80, C: 50+ @ $1.75):
 *      15 mi  -> 50 + 30 + 0   + 0    = $80
 *      25 mi  -> 50 + 50 + 0   + 0    = $100
 *      50 mi  -> 50 + 50 + 45  + 0    = $145
 *      100 mi -> 50 + 50 + 45  + 87.5 = $232.50
 *
 * 2. Flat (flat fee + extra mileage, schema name PER_MILE)
 *      total = baseFee + max(0, miles - flatMiles) × perMileRate
 *
 *    Example (baseFee=101, flatMiles=25, perMileRate=1.80):
 *      15 mi  -> 101 + 0    = $101
 *      25 mi  -> 101 + 0    = $101
 *      50 mi  -> 101 + 45   = $146
 *      100 mi -> 101 + 135  = $236
 *
 * 3. FLAT_TIER (DEPRECATED)
 *    No longer creatable via the admin UI. The calc branch has been
 *    removed. resolveEffectiveMode remaps any legacy FLAT_TIER config
 *    to PER_MILE so historical quote snapshots keep resolving.
 */

export type PricingMode = 'PER_MILE' | 'FLAT_TIER' | 'CATEGORY_ABC';

export type MileageCategory = 'A' | 'B' | 'C';

export type ServiceType =
  | 'STANDARD'
  | 'SAME_DAY'
  | 'AFTER_HOURS'
  | 'URGENT';

/**
 * Shape of a pricing config — accepts either the API PricingConfig type
 * or a partial form-state object (so the form can preview unsaved values).
 *
 * Fields are intentionally permissive (nullables) to match what real
 * configs look like in PER_MILE vs CATEGORY_ABC modes — only the fields
 * relevant to the active mode are required.
 */
export interface PricingCalcConfig {
  id: string;
  pricingMode: PricingMode;
  baseFee: number;
  flatMiles: number | null;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number | null;
  transactionFeeFixed: number | null;
  feePassThrough: boolean;
  driverSharePct: number;
  tiers: Array<{
    id?: string;
    minMiles: number;
    maxMiles: number | null;
    flatPrice: number;
  }>;
  categoryRules: Array<{
    id?: string;
    category: MileageCategory;
    minMiles: number;
    maxMiles: number | null;
    baseFee: number | null;
    flatPrice: number | null;
    perMileRate: number | null;
  }>;
}

export interface PricingCalcInput {
  config: PricingCalcConfig;
  distanceMiles: number;
  /**
   * Optional override of the effective pricing mode — used when a
   * customer has a `pricingModeOverride` that overrides the config's
   * `pricingMode`. When omitted, the config's `pricingMode` is used.
   */
  customerPricingModeOverride?: PricingMode | null;
  /**
   * Optional override of the mileage category (A/B/C). Only consulted
   * in CATEGORY_ABC mode. When supplied, the category-rule lookup
   * skips the minMiles/maxMiles range check — so the admin can
   * preview "what would category C cost at 10 miles?" even if the C
   * rule is normally scoped to 75+ miles.
   *
   * NOTE: With the new progressive-tiered ABC formula, this override is
   * informational only — ALL bands still contribute their miles. The
   * override only affects which category is reported in the result's
   * `mileageCategory` field (used for display purposes).
   */
  categoryOverride?: MileageCategory | null;
}

export interface PricingCalcResult {
  pricingConfigId: string;
  pricingMode: PricingMode;
  mileageCategory: MileageCategory | null;
  estimatedPrice: number;
  estimatedDriverPayout: number;
  feesBreakdown: {
    pricingConfigId: string;
    mode: PricingMode;
    baseFare: number;
    distanceCharge: number;
    insuranceFee: number;
    transactionFeeFixed: number;
    transactionFeePct: number;
    transactionFeePctAmount: number;
    transactionFee: number;
    feePassThrough: boolean;
    total: number;
    flatMilesAllowance?: number;
    billedMiles?: number;
    /**
     * Per-band breakdown for ABC mode (informational, for UI display).
     *
     * One entry per categoryRule row (sorted by minMiles) — including bands
     * with 0 miles in them. The UI uses this to render the progressive
     * tiered breakdown like:
     *   First  25 mi (0-25):  25 × $2.00 = $50.00
     *   Next   50 mi (25-75): 50 × $1.80 = $90.00
     *   Final  25 mi (75+):   25 × $1.75 = $43.75
     *
     * Fields:
     * - category: A/B/C (or whatever the rule's category is)
     * - lowerBound: previous band's maxMiles (or 0 for the first band)
     * - upperBound: this band's maxMiles (null = open-ended, e.g. category C)
     * - milesInBand: actual miles in this band for the trip distance (0 if trip didn't reach this band)
     * - perMileRate: this band's per-mile rate
     * - amount: milesInBand × perMileRate (rounded to 2 decimals)
     * - label: pre-formatted string label for convenience
     */
    bands?: Array<{
      label: string;
      category: MileageCategory;
      lowerBound: number;
      upperBound: number | null;
      milesInBand: number;
      perMileRate: number;
      amount: number;
    }>;
  };
}

/**
 * Resolve the mileage category (A / B / C) for a given distance.
 *
 * Band boundaries are read from the categoryRules in the config — NOT
 * hardcoded. The maxMiles of category A defines the A/B boundary, and the
 * maxMiles of category B defines the B/C boundary. Category C is always
 * "everything above B" (its maxMiles is typically null / open-ended).
 *
 * Fallbacks (used only when a rule is missing OR its maxMiles is null):
 *   A.maxMiles ?? 25
 *   B.maxMiles ?? 50
 * (These match the seed values in backend/scripts/seed/index.ts.)
 *
 * Backend mirror: backend/src/delivery-logistics/pricing-engine.service.ts
 *   PricingEngineService.resolveMileageCategory(miles, categoryRules)
 *
 * NOTE: This is purely for DISPLAY purposes (the `mileageCategory` field on
 * the Quote). The actual price math in `calculatePricing` iterates ALL bands
 * and does NOT call this function.
 */
export function resolveMileageCategory(
  miles: number,
  categoryRules?: Array<{ category: MileageCategory; maxMiles: number | null }> | null
): MileageCategory {
  const ruleA = categoryRules?.find((r) => r.category === 'A');
  const ruleB = categoryRules?.find((r) => r.category === 'B');

  const aMax = ruleA?.maxMiles ?? 25;
  const bMax = ruleB?.maxMiles ?? 50;

  if (miles <= aMax) return 'A';
  if (miles <= bMax) return 'B';
  return 'C';
}

/**
 * Round to 2 decimals — matches backend's `Number(x.toFixed(2))` pattern.
 */
function r2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Resolve the effective pricing mode given an optional customer override
 * and the config's default mode.
 *
 * Backend mirror: PricingEngineService.resolveEffectiveMode
 *
 * DEPRECATED: FLAT_TIER mode is no longer supported. If a config still has
 * pricingMode=FLAT_TIER (legacy), it is silently mapped to PER_MILE (Flat)
 * so the math still resolves. The admin UI no longer offers FLAT_TIER.
 */
export function resolveEffectiveMode(
  override: PricingMode | null | undefined,
  configMode: PricingMode
): PricingMode {
  if (override != null) {
    // FLAT_TIER override → fall back to PER_MILE (Flat with extra mileage).
    if (override === 'FLAT_TIER') return 'PER_MILE';
    return override;
  }
  // Legacy FLAT_TIER configs are treated as PER_MILE (Flat) at calculation time.
  if (configMode === 'FLAT_TIER') return 'PER_MILE';
  return configMode;
}

/**
 * Calculate a quote preview.
 *
 * Throws when:
 *   - distanceMiles < 0
 *   - PER_MILE mode and perMileRate is null
 *   - CATEGORY_ABC mode and no categoryRules are configured
 *
 * These error conditions match the backend's `BadRequestException`
 * throws — the caller should wrap in try/catch and surface the message.
 */
export function calculatePricing(input: PricingCalcInput): PricingCalcResult {
  const { config, distanceMiles } = input;

  if (distanceMiles < 0) {
    throw new Error('Distance miles must be >= 0');
  }

  const effectiveMode = resolveEffectiveMode(
    input.customerPricingModeOverride,
    config.pricingMode
  );

  let baseFare = 0;
  let distanceCharge = 0;
  let mileageCategory: MileageCategory | null = null;
  let bands: PricingCalcResult['feesBreakdown']['bands'] | undefined;
  let flatMilesAllowance: number | undefined;
  let billedMiles: number | undefined;

  if (effectiveMode === 'PER_MILE') {
    // ──────────────────────────────────────────────────────────────────
    // FLAT model (UI label: "Flat with extra mileage")
    // Schema name kept as PER_MILE for backward-compat with historical
    // quote snapshots.
    // Math: baseFee + max(0, miles - flatMiles) * perMileRate
    // ──────────────────────────────────────────────────────────────────
    if (config.perMileRate == null) {
      throw new Error('PER_MILE config requires perMileRate');
    }

    flatMilesAllowance = Number(config.flatMiles ?? 0);
    billedMiles = Number(Math.max(0, distanceMiles - flatMilesAllowance).toFixed(4));

    baseFare = r2(config.baseFee ?? 0);
    distanceCharge = r2(billedMiles * config.perMileRate);
  } else {
    // ──────────────────────────────────────────────────────────────────
    // ABC model (progressive tiered, schema name CATEGORY_ABC)
    //
    // Formula (tax-bracket style, bands defined in DB via categoryRules):
    //   price = baseFee
    //         + MIN(miles, maxMiles_A) × rate_A
    //         + MAX(0, MIN(miles, maxMiles_B) − maxMiles_A) × rate_B
    //         + MAX(0, miles − maxMiles_B) × rate_C
    //
    // where maxMiles_A / maxMiles_B come from the categoryRules rows.
    // The implementation iterates bands sorted by minMiles and tracks
    // prevUpper so bands are always contiguous (avoids the 0.01-mile gap
    // when admins enter 25.01 / 75.01).
    //
    // The config-level baseFee is added once on top. Per-rule baseFee /
    // flatPrice are NOT used by this formula (kept in schema for legacy
    // rows only).
    //
    // categoryOverride (Preview endpoint): informational only — the math
    // is purely distance-based and progressive. The override only affects
    // which category is REPORTED in the result's `mileageCategory` field
    // (used for UI display).
    // ──────────────────────────────────────────────────────────────────
    mileageCategory =
      input.categoryOverride ??
      resolveMileageCategory(distanceMiles, config.categoryRules);

    baseFare = r2(config.baseFee ?? 0);

    const sortedRules = [...config.categoryRules].sort(
      (a, b) => a.minMiles - b.minMiles
    );

    if (sortedRules.length === 0) {
      throw new Error(
        'CATEGORY_ABC config requires at least one category rule'
      );
    }

    bands = [];
    // Track the previous band's upper bound so we can use it as the next
    // band's lower bound (ensures contiguity — see comment in loop body).
    let prevUpper = 0;
    for (const rule of sortedRules) {
      // Use the PREVIOUS band's maxMiles as this band's lower bound so the
      // bands are always contiguous. This avoids the $0.02 gap that occurs
      // when admins enter minMiles=25.01 / 75.01 (the 0.01 anti-overlap
      // offset) — without this fix, those 0.01 miles at each boundary
      // would fall through the cracks and never be billed.
      // Example: 100mi with A(0-25@$2), B(25.01-75@$1.80), C(75.01-@$1.75)
      //   buggy (rule.minMiles): A=25mi + B=49.99mi + C=24.99mi = 99.98mi
      //   fixed (prevUpper):     A=25mi + B=50mi    + C=25mi    = 100mi
      const lower = prevUpper;
      const upper = rule.maxMiles == null ? Infinity : Number(rule.maxMiles);
      const milesInBand = Math.max(0, Math.min(distanceMiles, upper) - lower);
      const rate = Number(rule.perMileRate ?? 0);
      const amount = r2(milesInBand * rate);
      distanceCharge = r2(distanceCharge + amount);

      bands.push({
        label: `Band ${rule.category} (${lower}–${rule.maxMiles ?? '∞'} mi @ $${rate.toFixed(2)}/mi)`,
        category: rule.category,
        lowerBound: lower,
        upperBound: rule.maxMiles == null ? null : Number(rule.maxMiles),
        milesInBand: r2(milesInBand),
        perMileRate: rate,
        amount,
      });
      prevUpper = upper;
    }
  }

  const insuranceFee = r2(config.insuranceFee ?? 0);
  const subTotal = r2(baseFare + distanceCharge + insuranceFee);

  const transactionFeeFixed = r2(config.transactionFeeFixed ?? 0);
  const transactionFeePctRate = r2(config.transactionFeePct ?? 0);
  const transactionFeePctAmount = r2(
    ((config.transactionFeePct ?? 0) / 100) * subTotal
  );

  const transactionFee =
    config.feePassThrough === true
      ? r2(transactionFeeFixed + transactionFeePctAmount)
      : 0;

  const estimatedPrice = r2(subTotal + transactionFee);

  const driverSharePct = config.driverSharePct ?? 60;
  const driverShareAmount = r2(
    (estimatedPrice * driverSharePct) / 100
  );
  const estimatedDriverPayout = r2(
    Math.max(driverShareAmount - insuranceFee, 0)
  );

  return {
    pricingConfigId: config.id,
    pricingMode: effectiveMode,
    mileageCategory,
    estimatedPrice,
    estimatedDriverPayout,
    feesBreakdown: {
      pricingConfigId: config.id,
      mode: effectiveMode,
      baseFare,
      distanceCharge,
      insuranceFee,
      transactionFeeFixed,
      transactionFeePct: transactionFeePctRate,
      transactionFeePctAmount,
      transactionFee,
      feePassThrough: config.feePassThrough,
      total: estimatedPrice,
      ...(flatMilesAllowance != null
        ? { flatMilesAllowance, billedMiles: billedMiles ?? 0 }
        : {}),
      ...(bands && bands.length > 0 ? { bands } : {}),
    },
  };
}

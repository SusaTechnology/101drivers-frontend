/**
 * Shared pricing calculation utility.
 *
 * This is the SINGLE SOURCE OF TRUTH for pricing math on the frontend.
 * It mirrors the backend `PricingEngineService.calculateQuote` in
 * backend/src/delivery-logistics/pricing-engine.service.ts exactly —
 * same formulas, same rounding (Number(x.toFixed(2))), same mode
 * resolution, same mileage-category boundaries.
 *
 * Used by:
 *   - PricingConfigForm "Quote Preview" panel (Item 10)
 *   - admin-user-detail "Preview a Quote" dialog (Item 9)
 *   - Anywhere else a live quote preview is needed
 *
 * The backend remains authoritative for persisted quotes; this utility
 * is for live preview only. Keep the two implementations in sync — if
 * you change one, change the other.
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
 * configs look like in PER_MILE vs FLAT_TIER vs CATEGORY_ABC modes —
 * only the fields relevant to the active mode are required.
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
   * Backend mirror: PricingEngineService.computeQuoteFromConfig
   * (CATEGORY_ABC branch, input.categoryOverride handling).
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
  };
}

/**
 * Resolve the mileage category from a distance.
 *
 * Backend mirror: backend/src/delivery-logistics/pricing-engine.service.ts
 *   resolveMileageCategory(miles): miles ≤ 25 → A, ≤ 75 → B, else C
 */
export function resolveMileageCategory(miles: number): MileageCategory {
  if (miles <= 25) return 'A';
  if (miles <= 75) return 'B';
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
 */
export function resolveEffectiveMode(
  override: PricingMode | null | undefined,
  configMode: PricingMode
): PricingMode {
  if (override != null) return override;
  return configMode;
}

/**
 * Calculate a quote preview.
 *
 * Throws when:
 *   - distanceMiles < 0
 *   - PER_MILE mode and perMileRate is null
 *   - FLAT_TIER mode and no tier matches the distance
 *   - CATEGORY_ABC mode and no rule matches the resolved category
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

  if (effectiveMode === 'PER_MILE') {
    if (config.perMileRate == null) {
      throw new Error('PER_MILE config requires perMileRate');
    }

    // flatMiles is the "free miles included" allowance. NULL or 0 means
    // charge per-mile from mile 0 (legacy behavior).
    const flatMilesAllowance = Number(config.flatMiles ?? 0);
    const billableMiles = Number(
      Math.max(0, distanceMiles - flatMilesAllowance).toFixed(4)
    );

    baseFare = r2(config.baseFee ?? 0);
    distanceCharge = r2(billableMiles * config.perMileRate);
  } else if (effectiveMode === 'FLAT_TIER') {
    const tier = config.tiers.find((item) => {
      const lowerOk = distanceMiles >= item.minMiles;
      const upperOk = item.maxMiles == null || distanceMiles <= item.maxMiles;
      return lowerOk && upperOk;
    });

    if (!tier) {
      throw new Error('No flat tier configured for this mileage');
    }

    baseFare = r2(tier.flatPrice);
    distanceCharge = 0;
    mileageCategory = resolveMileageCategory(distanceMiles);
  } else {
    // CATEGORY_ABC
    mileageCategory =
      input.categoryOverride ?? resolveMileageCategory(distanceMiles);

    const rule = config.categoryRules.find((item) => {
      const categoryOk = item.category === mileageCategory;

      // When an admin forces a category via categoryOverride, skip the
      // distance-range check — mirrors the backend behavior so the admin
      // can preview "what would category C cost at 10 miles?" even if the
      // C rule is normally scoped to 75+ miles.
      if (input.categoryOverride != null) {
        return categoryOk;
      }

      const lowerOk = distanceMiles >= item.minMiles;
      const upperOk = item.maxMiles == null || distanceMiles <= item.maxMiles;
      return categoryOk && lowerOk && upperOk;
    });

    if (!rule) {
      throw new Error(
        `No CATEGORY_ABC pricing rule configured for mileage category ${mileageCategory}`
      );
    }

    if (rule.flatPrice != null) {
      baseFare = r2(rule.flatPrice);
      distanceCharge = 0;
    } else {
      baseFare = r2(rule.baseFee ?? config.baseFee ?? 0);
      const effectiveRate = rule.perMileRate ?? config.perMileRate;
      if (effectiveRate == null) {
        throw new Error(
          `Category ${mileageCategory} requires perMileRate or flatPrice`
        );
      }
      distanceCharge = r2(distanceMiles * effectiveRate);
    }
  }

  const insuranceFee = r2(config.insuranceFee ?? 0);
  const subTotal = r2(baseFare + distanceCharge + insuranceFee);

  const transactionFeeFixed = r2(config.transactionFeeFixed ?? 0);
  const transactionFeePctRate = r2(config.transactionFeePct ?? 0);
  const transactionFeePctAmount = r2(
    ((config.transactionFeePct ?? 0) / 100) * subTotal
  );

  const transactionFee = config.feePassThrough
    ? r2(transactionFeeFixed + transactionFeePctAmount)
    : 0;

  const estimatedPrice = r2(subTotal + transactionFee);

  // Driver payout = estimatedPrice × driverSharePct% - insuranceFee (floored at 0)
  const driverSharePct = config.driverSharePct ?? 60;
  const driverShareAmount = r2(estimatedPrice * (driverSharePct / 100));
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
      ...(effectiveMode === 'PER_MILE'
        ? {
            flatMilesAllowance: r2(config.flatMiles ?? 0),
            billedMiles: r2(
              Math.max(0, distanceMiles - (config.flatMiles ?? 0))
            ),
          }
        : {}),
    },
  };
}

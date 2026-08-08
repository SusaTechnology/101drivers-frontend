/**
 * Shared pricing calculation utility.
 *
 * Single source of truth for the two pricing models supported by the platform:
 *
 *   1. ABC (progressive tiered, a.k.a. CATEGORY_ABC in the schema)
 *        total = baseFee
 *              + (miles in band A) * rateA
 *              + (miles in band B) * rateB
 *              + (miles in band C) * rateC
 *      where bands are defined by `categoryRules` rows (sorted by minMiles).
 *      Each row contributes: max(0, min(miles, row.maxMiles ?? Infinity) - row.minMiles) * row.perMileRate
 *
 *      Example (baseFee=50, A: 0-25 @ $2.00, B: 25-50 @ $1.80, C: 50+ @ $1.75):
 *        15 mi  -> 50 + 30 + 0 + 0       = $80
 *        25 mi  -> 50 + 50 + 0 + 0       = $100
 *        50 mi  -> 50 + 50 + 45 + 0      = $145
 *        100 mi -> 50 + 50 + 45 + 87.50  = $232.50
 *
 *   2. Flat (flat fee + extra mileage, a.k.a. PER_MILE in the schema)
 *        total = baseFee + max(0, miles - flatMiles) * perMileRate
 *
 *      Example (baseFee=101, flatMiles=25, perMileRate=1.80):
 *        15 mi  -> 101 + 0    = $101
 *        25 mi  -> 101 + 0    = $101
 *        50 mi  -> 101 + 45   = $146
 *        100 mi -> 101 + 135  = $236
 *
 * Note: The schema also has a FLAT_TIER mode (pick-one-tier-flat-price). That mode
 * is DEPRECATED — hidden from the admin UI and the backend calculation branch is
 * commented out. The enum value is kept in Prisma only so historical quote
 * snapshots continue to resolve. No new configs should use it.
 */

export type PricingMode = 'PER_MILE' | 'FLAT_TIER' | 'CATEGORY_ABC';

export interface PricingBand {
  /** Lower bound of the band (inclusive). */
  minMiles: number;
  /** Upper bound of the band (inclusive). NULL = open-ended. */
  maxMiles: number | null;
  /** Per-mile rate applied to miles falling within this band. */
  perMileRate: number | null;
}

export interface PricingCalcInput {
  pricingMode: PricingMode;
  baseFee: number;
  /** PER_MILE only. Free miles included in the base fee. */
  flatMiles?: number | null;
  /** PER_MILE only. Per-mile rate applied after flatMiles. */
  perMileRate?: number | null;
  /** CATEGORY_ABC only. Ordered list of mileage bands. */
  categoryRules?: PricingBand[];
  /** Distance to price. */
  distanceMiles: number;
}

export interface PricingCalcBreakdownBand {
  label: string;
  milesInBand: number;
  perMileRate: number;
  amount: number;
}

export interface PricingCalcResult {
  /** Base fee charged once (the config-level baseFee). */
  baseFare: number;
  /** Variable portion: distance-based charges (tiered for ABC, per-mile for Flat). */
  distanceCharge: number;
  /** Subtotal before insurance / transaction fees. Equal to baseFare + distanceCharge. */
  subTotal: number;
  /** Grand total INCLUDING insurance + transaction fees (only if `applyFees` is true). */
  total: number;
  /** Per-band breakdown (ABC mode) or single-line breakdown (PER_MILE mode). */
  bands: PricingCalcBreakdownBand[];
  /** Effective miles billed (after flatMiles allowance for PER_MILE; same as input for ABC). */
  billedMiles: number;
}

export interface PricingFeeOptions {
  insuranceFee?: number | null;
  transactionFeeFixed?: number | null;
  transactionFeePct?: number | null;
  /** When true, transaction fees are passed through to the customer. */
  feePassThrough?: boolean;
}

const round2 = (n: number): number => Number(n.toFixed(2));

/**
 * Calculate the ABC (progressive tiered) fare.
 *
 * Iterates through `bands` sorted by minMiles. For each band, the miles that
 * fall into [minMiles, maxMiles] are billed at that band's perMileRate.
 * The config-level baseFee is added once on top.
 */
function calculateABC(
  baseFee: number,
  bands: PricingBand[],
  miles: number,
): { distanceCharge: number; bands: PricingCalcBreakdownBand[] } {
  const sorted = [...bands].sort((a, b) => a.minMiles - b.minMiles);

  let distanceCharge = 0;
  const breakdown: PricingCalcBreakdownBand[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];
    const upper = band.maxMiles ?? Infinity;
    const lower = band.minMiles;
    const milesInBand = Math.max(0, Math.min(miles, upper) - lower);
    const rate = band.perMileRate ?? 0;
    const amount = round2(milesInBand * rate);

    distanceCharge = round2(distanceCharge + amount);

    breakdown.push({
      label: `Band ${i + 1} (${lower}–${band.maxMiles ?? '∞'} mi @ $${rate.toFixed(2)}/mi)`,
      milesInBand: round2(milesInBand),
      perMileRate: rate,
      amount,
    });
  }

  return { distanceCharge, bands: breakdown };
}

/**
 * Calculate the Flat (flat fee + extra mileage) fare.
 *
 * Formula: baseFee + max(0, miles - flatMiles) * perMileRate
 */
function calculateFlat(
  baseFee: number,
  flatMiles: number,
  perMileRate: number,
  miles: number,
): { distanceCharge: number; bands: PricingCalcBreakdownBand[]; billedMiles: number } {
  const billedMiles = Math.max(0, miles - flatMiles);
  const distanceCharge = round2(billedMiles * perMileRate);

  const breakdown: PricingCalcBreakdownBand[] = [
    {
      label: `Flat portion (first ${flatMiles} mi included in base fee)`,
      milesInBand: 0,
      perMileRate: 0,
      amount: 0,
    },
    {
      label: `Extra mileage (${billedMiles} mi @ $${perMileRate.toFixed(2)}/mi)`,
      milesInBand: round2(billedMiles),
      perMileRate,
      amount: distanceCharge,
    },
  ];

  return { distanceCharge, bands: breakdown, billedMiles };
}

/**
 * Main entry point. Returns baseFare, distanceCharge, subTotal, total, and a
 * per-band breakdown. If `fees` is provided, `total` includes insurance +
 * transaction fees; otherwise `total === subTotal`.
 */
export function calculatePricing(
  input: PricingCalcInput,
  fees?: PricingFeeOptions,
): PricingCalcResult {
  const miles = Math.max(0, Number(input.distanceMiles) || 0);
  const baseFee = round2(Number(input.baseFee) || 0);

  let distanceCharge = 0;
  let bands: PricingCalcBreakdownBand[] = [];
  let billedMiles = miles;

  if (input.pricingMode === 'PER_MILE') {
    const flatMiles = Number(input.flatMiles ?? 0);
    const perMileRate = Number(input.perMileRate ?? 0);
    const r = calculateFlat(baseFee, flatMiles, perMileRate, miles);
    distanceCharge = r.distanceCharge;
    bands = r.bands;
    billedMiles = r.billedMiles;
  } else if (input.pricingMode === 'CATEGORY_ABC') {
    const r = calculateABC(baseFee, input.categoryRules ?? [], miles);
    distanceCharge = r.distanceCharge;
    bands = r.bands;
  } else if (input.pricingMode === 'FLAT_TIER') {
    // DEPRECATED mode. No new configs should use this. Kept here only so the
    // function remains total; the admin UI no longer offers FLAT_TIER.
    throw new Error(
      'FLAT_TIER mode is deprecated. Use PER_MILE (Flat) or CATEGORY_ABC (ABC) instead.',
    );
  } else {
    throw new Error(`Unknown pricing mode: ${input.pricingMode as string}`);
  }

  const subTotal = round2(baseFee + distanceCharge);

  let total = subTotal;
  if (fees) {
    const insuranceFee = round2(Number(fees.insuranceFee ?? 0));
    const withInsurance = round2(subTotal + insuranceFee);

    const transactionFeeFixed = round2(Number(fees.transactionFeeFixed ?? 0));
    const transactionFeePctRate = Number(fees.transactionFeePct ?? 0);
    const transactionFeePctAmount = round2(
      (transactionFeePctRate / 100) * withInsurance,
    );
    const transactionFee =
      fees.feePassThrough === true
        ? round2(transactionFeeFixed + transactionFeePctAmount)
        : 0;

    total = round2(withInsurance + transactionFee);
  }

  return {
    baseFare: baseFee,
    distanceCharge,
    subTotal,
    total,
    bands,
    billedMiles,
  };
}

/**
 * Convenience helper: returns ONLY the grand total. Useful for inline previews
 * where the breakdown isn't needed.
 */
export function calculatePricingTotal(
  input: PricingCalcInput,
  fees?: PricingFeeOptions,
): number {
  return calculatePricing(input, fees).total;
}

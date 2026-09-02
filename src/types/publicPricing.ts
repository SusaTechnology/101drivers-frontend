/**
 * Frontend type mirror of `PublicPricingConfigDto` from
 * backend/src/pricingConfig/dto/pricingConfigPublic.dto.ts.
 *
 * Kept hand-written (not auto-generated) so the home page can consume
 * the public pricing endpoint WITHOUT a tight coupling to the full
 * admin PricingConfig schema. The backend DTO is the source of truth;
 * if it changes, update this interface to match.
 */

export type PublicPricingMode = 'PER_MILE' | 'CATEGORY_ABC';

export interface PublicPricingTierBand {
  category: string;
  minMiles: number;
  maxMiles: number | null;
  perMileRate: number | null;
}

export interface PublicPricingConfig {
  pricingMode: PublicPricingMode;
  baseFee: number;
  flatMiles: number | null;
  perMileRate: number | null;
  insuranceFee: number;
  transactionFeePct: number | null;
  transactionFeeFixed: number | null;
  feePassThrough: boolean;
  tierBands: PublicPricingTierBand[];
  updatedAt: string;
}

import { describe, expect, it } from 'vitest';
import {
  calculatePricing,
  resolveEffectiveMode,
  resolveMileageCategory,
  type PricingCalcConfig,
} from './calculate';

/**
 * These tests assert the shared pricing utility produces values that
 * exactly match what the backend PricingEngineService would compute.
 *
 * Hand-computed expectations — derived from the formulas documented in
 * backend/src/delivery-logistics/pricing-engine.service.ts (L99-L197).
 */

const baseConfig: PricingCalcConfig = {
  id: 'cfg_test',
  pricingMode: 'PER_MILE',
  baseFee: 100,
  flatMiles: 50,
  perMileRate: 2,
  insuranceFee: 8,
  transactionFeePct: 2.9,
  transactionFeeFixed: 3,
  feePassThrough: true,
  driverSharePct: 60,
  tiers: [
    { minMiles: 0, maxMiles: 25, flatPrice: 120 },
    { minMiles: 25.01, maxMiles: 75, flatPrice: 180 },
    { minMiles: 75.01, maxMiles: null, flatPrice: 260 },
  ],
  categoryRules: [
    {
      category: 'A',
      minMiles: 0,
      maxMiles: 25,
      baseFee: 40,
      perMileRate: 3.5,
      flatPrice: null,
    },
    {
      category: 'B',
      minMiles: 25.01,
      maxMiles: 75,
      baseFee: 55,
      perMileRate: 4.25,
      flatPrice: null,
    },
    {
      category: 'C',
      minMiles: 75.01,
      maxMiles: null,
      baseFee: 70,
      perMileRate: 5.25,
      flatPrice: null,
    },
  ],
};

describe('resolveMileageCategory', () => {
  it('boundary at 25 miles → A (inclusive)', () => {
    expect(resolveMileageCategory(0)).toBe('A');
    expect(resolveMileageCategory(25)).toBe('A');
  });

  it('boundary at 75 miles → B (inclusive)', () => {
    expect(resolveMileageCategory(25.01)).toBe('B');
    expect(resolveMileageCategory(75)).toBe('B');
  });

  it('above 75 → C', () => {
    expect(resolveMileageCategory(75.01)).toBe('C');
    expect(resolveMileageCategory(500)).toBe('C');
  });
});

describe('resolveEffectiveMode', () => {
  it('uses override when provided', () => {
    expect(resolveEffectiveMode('FLAT_TIER', 'PER_MILE')).toBe('FLAT_TIER');
    expect(resolveEffectiveMode('CATEGORY_ABC', 'FLAT_TIER')).toBe(
      'CATEGORY_ABC'
    );
  });

  it('falls back to configMode when override is null/undefined', () => {
    expect(resolveEffectiveMode(null, 'PER_MILE')).toBe('PER_MILE');
    expect(resolveEffectiveMode(undefined, 'FLAT_TIER')).toBe('FLAT_TIER');
  });
});

describe('calculatePricing — PER_MILE mode', () => {
  it('50mi with flatMiles=50 → only baseFee + insurance, no per-mile charge', () => {
    // billableMiles = max(0, 50 - 50) = 0
    // baseFare = 100
    // distanceCharge = 0 * 2 = 0
    // subTotal = 100 + 0 + 8 = 108
    // transactionFeeFixed = 3, transactionFeePctAmount = 108 * 0.029 = 3.13
    // transactionFee = 3 + 3.13 = 6.13
    // estimatedPrice = 108 + 6.13 = 114.13
    // driverShareAmount = 114.13 * 0.6 = 68.48
    // estimatedDriverPayout = max(68.48 - 8, 0) = 60.48
    const result = calculatePricing({
      config: baseConfig,
      distanceMiles: 50,
    });
    expect(result.pricingMode).toBe('PER_MILE');
    expect(result.mileageCategory).toBeNull();
    expect(result.feesBreakdown.baseFare).toBe(100);
    expect(result.feesBreakdown.distanceCharge).toBe(0);
    expect(result.feesBreakdown.billedMiles).toBe(0);
    expect(result.feesBreakdown.flatMilesAllowance).toBe(50);
    expect(result.feesBreakdown.insuranceFee).toBe(8);
    expect(result.feesBreakdown.transactionFee).toBe(6.13);
    expect(result.estimatedPrice).toBe(114.13);
    expect(result.estimatedDriverPayout).toBe(60.48);
  });

  it('75mi with flatMiles=50 → 25 billable miles', () => {
    // billableMiles = 75 - 50 = 25
    // baseFare = 100, distanceCharge = 25 * 2 = 50
    // subTotal = 100 + 50 + 8 = 158
    // transactionFee = 3 + 158 * 0.029 = 3 + 4.58 = 7.58
    // estimatedPrice = 158 + 7.58 = 165.58
    // driverShareAmount = 165.58 * 0.6 = 99.35
    // estimatedDriverPayout = max(99.35 - 8, 0) = 91.35
    const result = calculatePricing({
      config: baseConfig,
      distanceMiles: 75,
    });
    expect(result.feesBreakdown.billedMiles).toBe(25);
    expect(result.feesBreakdown.distanceCharge).toBe(50);
    expect(result.estimatedPrice).toBe(165.58);
    expect(result.estimatedDriverPayout).toBe(91.35);
  });

  it('30mi with flatMiles=50 → no per-mile charge (within allowance)', () => {
    // billableMiles = max(0, 30 - 50) = 0
    const result = calculatePricing({
      config: baseConfig,
      distanceMiles: 30,
    });
    expect(result.feesBreakdown.billedMiles).toBe(0);
    expect(result.estimatedPrice).toBe(114.13); // same as 50mi case
  });

  it('flatMiles=null → charges per-mile from mile 0', () => {
    // billableMiles = 50 - 0 = 50
    // distanceCharge = 50 * 2 = 100
    // subTotal = 100 + 100 + 8 = 208
    // transactionFee = 3 + 208 * 0.029 = 3 + 6.03 = 9.03
    // estimatedPrice = 208 + 9.03 = 217.03
    const result = calculatePricing({
      config: { ...baseConfig, flatMiles: null },
      distanceMiles: 50,
    });
    expect(result.feesBreakdown.billedMiles).toBe(50);
    expect(result.feesBreakdown.distanceCharge).toBe(100);
    expect(result.estimatedPrice).toBe(217.03);
  });

  it('throws if perMileRate is null in PER_MILE mode', () => {
    expect(() =>
      calculatePricing({
        config: { ...baseConfig, perMileRate: null },
        distanceMiles: 50,
      })
    ).toThrow('PER_MILE config requires perMileRate');
  });
});

describe('calculatePricing — FLAT_TIER mode', () => {
  it('30mi falls in the 25.01–75 tier → flatPrice 180', () => {
    // baseFare = 180, distanceCharge = 0
    // subTotal = 180 + 0 + 8 = 188
    // transactionFee = 3 + 188 * 0.029 = 3 + 5.45 = 8.45
    // estimatedPrice = 188 + 8.45 = 196.45
    // mileageCategory for 30mi = B
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'FLAT_TIER' },
      distanceMiles: 30,
    });
    expect(result.pricingMode).toBe('FLAT_TIER');
    expect(result.mileageCategory).toBe('B');
    expect(result.feesBreakdown.baseFare).toBe(180);
    expect(result.feesBreakdown.distanceCharge).toBe(0);
    expect(result.estimatedPrice).toBe(196.45);
  });

  it('10mi falls in the 0–25 tier → flatPrice 120', () => {
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'FLAT_TIER' },
      distanceMiles: 10,
    });
    expect(result.feesBreakdown.baseFare).toBe(120);
    expect(result.mileageCategory).toBe('A');
  });

  it('throws when no tier matches', () => {
    expect(() =>
      calculatePricing({
        config: {
          ...baseConfig,
          pricingMode: 'FLAT_TIER',
          tiers: [{ minMiles: 100, maxMiles: 200, flatPrice: 500 }],
        },
        distanceMiles: 50,
      })
    ).toThrow('No flat tier configured for this mileage');
  });
});

describe('calculatePricing — CATEGORY_ABC mode', () => {
  it('15mi → category A, baseFee 40, perMileRate 3.5', () => {
    // baseFare = 40, distanceCharge = 15 * 3.5 = 52.5
    // subTotal = 40 + 52.5 + 8 = 100.5
    // transactionFee = 3 + 100.5 * 0.029 = 3 + 2.91 = 5.91
    // estimatedPrice = 100.5 + 5.91 = 106.41
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'CATEGORY_ABC' },
      distanceMiles: 15,
    });
    expect(result.pricingMode).toBe('CATEGORY_ABC');
    expect(result.mileageCategory).toBe('A');
    expect(result.feesBreakdown.baseFare).toBe(40);
    expect(result.feesBreakdown.distanceCharge).toBe(52.5);
    expect(result.estimatedPrice).toBe(106.41);
  });

  it('50mi → category B, baseFee 55, perMileRate 4.25', () => {
    // baseFare = 55, distanceCharge = 50 * 4.25 = 212.5
    // subTotal = 55 + 212.5 + 8 = 275.5
    // transactionFee = 3 + 275.5 * 0.029 = 3 + 7.99 = 10.99
    // estimatedPrice = 275.5 + 10.99 = 286.49
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'CATEGORY_ABC' },
      distanceMiles: 50,
    });
    expect(result.mileageCategory).toBe('B');
    expect(result.feesBreakdown.baseFare).toBe(55);
    expect(result.feesBreakdown.distanceCharge).toBe(212.5);
    expect(result.estimatedPrice).toBe(286.49);
  });

  it('100mi → category C', () => {
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'CATEGORY_ABC' },
      distanceMiles: 100,
    });
    expect(result.mileageCategory).toBe('C');
    expect(result.feesBreakdown.baseFare).toBe(70);
  });

  it('honors rule.flatPrice when set (over baseFee+perMile)', () => {
    const result = calculatePricing({
      config: {
        ...baseConfig,
        pricingMode: 'CATEGORY_ABC',
        categoryRules: [
          {
            category: 'A',
            minMiles: 0,
            maxMiles: 25,
            baseFee: null,
            perMileRate: null,
            flatPrice: 99.99,
          },
          ...baseConfig.categoryRules.slice(1),
        ],
      },
      distanceMiles: 10,
    });
    expect(result.feesBreakdown.baseFare).toBe(99.99);
    expect(result.feesBreakdown.distanceCharge).toBe(0);
  });
});

describe('calculatePricing — feePassThrough=false', () => {
  it('transactionFee is 0 when feePassThrough is false', () => {
    const result = calculatePricing({
      config: { ...baseConfig, feePassThrough: false },
      distanceMiles: 50,
    });
    expect(result.feesBreakdown.transactionFee).toBe(0);
    // estimatedPrice = subTotal only = 100 + 0 + 8 = 108
    expect(result.estimatedPrice).toBe(108);
  });
});

describe('calculatePricing — validation', () => {
  it('throws on negative distance', () => {
    expect(() =>
      calculatePricing({ config: baseConfig, distanceMiles: -1 })
    ).toThrow('Distance miles must be >= 0');
  });

  it('0 miles is allowed in PER_MILE', () => {
    const result = calculatePricing({
      config: baseConfig,
      distanceMiles: 0,
    });
    // billableMiles = 0, distanceCharge = 0
    // estimatedPrice = 100 + 0 + 8 + 3 + 3.13 = 114.13
    expect(result.estimatedPrice).toBe(114.13);
  });
});

describe('calculatePricing — customer override', () => {
  it('customerPricingModeOverride=FLAT_TIER forces FLAT_TIER even if config is PER_MILE', () => {
    const result = calculatePricing({
      config: baseConfig, // pricingMode PER_MILE
      distanceMiles: 30,
      customerPricingModeOverride: 'FLAT_TIER',
    });
    expect(result.pricingMode).toBe('FLAT_TIER');
    expect(result.feesBreakdown.baseFare).toBe(180); // tier 25.01–75
  });
});

describe('calculatePricing — categoryOverride (CATEGORY_ABC)', () => {
  it('categoryOverride=C forces category C even at 10mi (skips distance-range check)', () => {
    // Without override, 10mi → category A (baseFee 40, rate 3.5).
    // With override='C', the math uses category C rule (baseFee 70, rate 5.25)
    // even though the C rule's minMiles is 75.01.
    //   baseFare = 70, distanceCharge = 10 * 5.25 = 52.5
    //   subTotal = 70 + 52.5 + 8 = 130.5
    //   transactionFee = 3 + 130.5 * 0.029 = 3 + 3.78 = 6.78
    //   estimatedPrice = 130.5 + 6.78 = 137.28
    const result = calculatePricing({
      config: { ...baseConfig, pricingMode: 'CATEGORY_ABC' },
      distanceMiles: 10,
      categoryOverride: 'C',
    });
    expect(result.mileageCategory).toBe('C');
    expect(result.feesBreakdown.baseFare).toBe(70);
    expect(result.feesBreakdown.distanceCharge).toBe(52.5);
    expect(result.estimatedPrice).toBe(137.28);
  });

  it('categoryOverride ignored in PER_MILE mode', () => {
    const result = calculatePricing({
      config: baseConfig, // PER_MILE
      distanceMiles: 50,
      categoryOverride: 'C',
    });
    // PER_MILE doesn't consult mileageCategory for pricing — result is
    // the same as without the override.
    expect(result.pricingMode).toBe('PER_MILE');
    expect(result.mileageCategory).toBeNull();
    expect(result.estimatedPrice).toBe(114.13);
  });
});

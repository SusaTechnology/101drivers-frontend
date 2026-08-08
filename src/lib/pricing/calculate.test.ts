// Quick sanity check for the shared pricing utility.
// Run: npx tsx /home/z/my-project/repo/src/lib/pricing/calculate.test.ts

import { calculatePricing, type PricingCalcConfig } from './calculate';

const abcConfig: PricingCalcConfig = {
  id: 'abc-test',
  pricingMode: 'CATEGORY_ABC',
  baseFee: 50,
  flatMiles: null,
  perMileRate: null,
  insuranceFee: 0,
  transactionFeePct: null,
  transactionFeeFixed: null,
  feePassThrough: false,
  driverSharePct: 60,
  tiers: [],
  categoryRules: [
    { category: 'A', minMiles: 0, maxMiles: 25, baseFee: null, flatPrice: null, perMileRate: 2.0 },
    { category: 'B', minMiles: 25, maxMiles: 50, baseFee: null, flatPrice: null, perMileRate: 1.8 },
    { category: 'C', minMiles: 50, maxMiles: null, baseFee: null, flatPrice: null, perMileRate: 1.75 },
  ],
};

const flatConfig: PricingCalcConfig = {
  id: 'flat-test',
  pricingMode: 'PER_MILE',
  baseFee: 101,
  flatMiles: 25,
  perMileRate: 1.8,
  insuranceFee: 0,
  transactionFeePct: null,
  transactionFeeFixed: null,
  feePassThrough: false,
  driverSharePct: 60,
  tiers: [],
  categoryRules: [],
};

const cases: Array<{ mode: 'ABC' | 'Flat'; miles: number; expected: number }> = [
  { mode: 'ABC', miles: 15, expected: 80 },
  { mode: 'ABC', miles: 25, expected: 100 },
  { mode: 'ABC', miles: 50, expected: 145 },
  { mode: 'ABC', miles: 100, expected: 232.5 },
  { mode: 'Flat', miles: 15, expected: 101 },
  { mode: 'Flat', miles: 25, expected: 101 },
  { mode: 'Flat', miles: 50, expected: 146 },
  { mode: 'Flat', miles: 100, expected: 236 },
];

let allPassed = true;
for (const c of cases) {
  const r = calculatePricing({
    config: c.mode === 'ABC' ? abcConfig : flatConfig,
    distanceMiles: c.miles,
  });

  const ok = r.estimatedPrice === c.expected;
  if (!ok) allPassed = false;
  console.log(
    `${ok ? '✓' : '✗'} ${c.mode} @ ${c.miles} mi -> got $${r.estimatedPrice}, expected $${c.expected}` +
      (ok ? '' : ` [base=$${r.feesBreakdown.baseFare} dist=$${r.feesBreakdown.distanceCharge}]`),
  );
}

console.log(allPassed ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allPassed ? 0 : 1);

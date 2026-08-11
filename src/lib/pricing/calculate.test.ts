// Quick sanity check for the shared pricing utility.
// Run: npx tsx /home/z/my-project/repo/src/lib/pricing/calculate.test.ts

import { calculatePricing, type PricingCalcConfig } from './calculate';

// Config A: contiguous bands (B's minMiles = A's maxMiles, no gap).
// Both buggy (rule.minMiles) and fixed (prevUpper) versions produce
// identical results here.
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

// Config B: realistic DEFAULT_CATEGORY_RULES values (with 0.01 anti-overlap
// offsets). This is what production actually uses. Without the prevUpper fix,
// 0.02 miles would fall through the cracks at the A→B and B→C boundaries.
const abcConfigWithGaps: PricingCalcConfig = {
  id: 'abc-gaps-test',
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
    { category: 'A', minMiles: 0,     maxMiles: 25,   baseFee: null, flatPrice: null, perMileRate: 2.0 },
    { category: 'B', minMiles: 25.01, maxMiles: 75,   baseFee: null, flatPrice: null, perMileRate: 1.8 },
    { category: 'C', minMiles: 75.01, maxMiles: null, baseFee: null, flatPrice: null, perMileRate: 1.75 },
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

const cases: Array<{ mode: 'ABC' | 'ABC-gaps' | 'Flat'; miles: number; expected: number }> = [
  // Contiguous bands (no gap) — both buggy and fixed versions pass
  { mode: 'ABC', miles: 15, expected: 80 },
  { mode: 'ABC', miles: 25, expected: 100 },
  { mode: 'ABC', miles: 50, expected: 145 },
  { mode: 'ABC', miles: 100, expected: 232.5 },
  // Realistic DEFAULT_CATEGORY_RULES (with 0.01 gaps) — these are the
  // user-documented expected values from the original spec:
  //   First 25mi × $2.00 = $50.00
  //   Next 50mi (25-75) × $1.80 = $90.00
  //   Final 25mi (75-100) × $1.75 = $43.75
  //   Subtotal variable: $183.75 + Base $50 = $233.75
  // The buggy version would give 50 + 89.98 + 43.73 = 183.71 + 50 = $233.71.
  { mode: 'ABC-gaps', miles: 15,  expected: 80.00 },
  { mode: 'ABC-gaps', miles: 25,  expected: 100.00 },
  { mode: 'ABC-gaps', miles: 50,  expected: 145.00 },
  { mode: 'ABC-gaps', miles: 100, expected: 233.75 },
  // Flat mode (PER_MILE) — unchanged by ABC fix
  { mode: 'Flat', miles: 15, expected: 101 },
  { mode: 'Flat', miles: 25, expected: 101 },
  { mode: 'Flat', miles: 50, expected: 146 },
  { mode: 'Flat', miles: 100, expected: 236 },
];

let allPassed = true;
for (const c of cases) {
  const config =
    c.mode === 'ABC' ? abcConfig :
    c.mode === 'ABC-gaps' ? abcConfigWithGaps :
    flatConfig;
  const r = calculatePricing({
    config,
    distanceMiles: c.miles,
  });

  const ok = r.estimatedPrice === c.expected;
  if (!ok) allPassed = false;
  console.log(
    `${ok ? '✓' : '✗'} ${c.mode.padEnd(9)} @ ${c.miles.toString().padStart(3)} mi -> got $${r.estimatedPrice}, expected $${c.expected}` +
      (ok ? '' : ` [base=$${r.feesBreakdown.baseFare} dist=$${r.feesBreakdown.distanceCharge}]`),
  );
}

console.log(allPassed ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allPassed ? 0 : 1);

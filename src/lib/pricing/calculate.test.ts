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

// ─────────────────────────────────────────────────────────────────────
// Verify the bands[] array shape for ABC mode — the form's Quote Preview
// panel renders this directly, so the shape must remain stable.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== bands[] shape verification (100mi, ABC-gaps config) ===');
const bandsTest = calculatePricing({
  config: abcConfigWithGaps,
  distanceMiles: 100,
});
const bands = bandsTest.feesBreakdown.bands ?? [];
console.log(`  bands.length = ${bands.length} (expected 3)`);
console.log(`  total       = $${bandsTest.estimatedPrice.toFixed(2)} (expected $233.75)`);
for (const b of bands) {
  console.log(
    `  Band ${b.category}: ${b.milesInBand} mi × $${b.perMileRate.toFixed(2)} = $${b.amount.toFixed(2)}  ` +
    `(lower=${b.lowerBound}, upper=${b.upperBound ?? 'null'})`
  );
}

// Hard assertions on the band shape — fail loudly if anyone changes the math
const expectedBands = [
  { category: 'A', milesInBand: 25,   rate: 2.0,  amount: 50.00,  lower: 0,  upper: 25 },
  { category: 'B', milesInBand: 50,   rate: 1.8,  amount: 90.00,  lower: 25, upper: 75 },
  { category: 'C', milesInBand: 25,   rate: 1.75, amount: 43.75,  lower: 75, upper: null },
];
let bandsPass = bands.length === expectedBands.length;
for (let i = 0; i < expectedBands.length; i++) {
  const got = bands[i];
  const want = expectedBands[i];
  const match =
    got.category === want.category &&
    got.milesInBand === want.milesInBand &&
    got.perMileRate === want.rate &&
    got.amount === want.amount &&
    got.lowerBound === want.lower &&
    got.upperBound === want.upper;
  if (!match) {
    bandsPass = false;
    console.log(`  ✗ Band ${want.category} mismatch: got ${JSON.stringify(got)}`);
  }
}
console.log(bandsPass ? '\nBANDS SHAPE: PASS' : '\nBANDS SHAPE: FAIL');

// ─────────────────────────────────────────────────────────────────────
// DYNAMIC INPUT VERIFICATION
// Demonstrates that the calculation is driven entirely by the input
// field values (categoryRules array) — NOT by any hardcoded constants.
// We mutate the rule values and verify the result changes accordingly.
// This is the contract the Quote Preview UI relies on: when the admin
// edits an input field, the preview must reflect the new value.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== dynamic input verification (editing categoryRules fields) ===');

// Start from the user's actual production config: A(0-25), B(25-50), C(50+)
// For a 100mi trip, this gives:
//   A: 25 × $2.00 = $50.00
//   B: 25 × $1.80 = $45.00   (band B is only 25mi wide: 25 to 50)
//   C: 50 × $1.75 = $87.50
//   Subtotal: $182.50 + base $50 = $232.50
const prodLikeConfig: PricingCalcConfig = {
  id: 'prod-like',
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

const before = calculatePricing({ config: prodLikeConfig, distanceMiles: 100 });
console.log(`  Before edit (B.maxMiles=50, B.rate=$1.80): $${before.estimatedPrice.toFixed(2)} (expected $232.50)`);
const beforePass = before.estimatedPrice === 232.50;

// Simulate the admin editing the B.maxMiles input from 50 → 75 in the form.
// Now band B is 50mi wide (25 to 75), so:
//   A: 25 × $2.00 = $50.00
//   B: 50 × $1.80 = $90.00
//   C: 25 × $1.75 = $43.75
//   Subtotal: $183.75 + base $50 = $233.75
const afterMaxMilesEdit = calculatePricing({
  config: {
    ...prodLikeConfig,
    categoryRules: [
      prodLikeConfig.categoryRules[0],
      { ...prodLikeConfig.categoryRules[1], maxMiles: 75 },  // ← edited
      prodLikeConfig.categoryRules[2],
    ],
  },
  distanceMiles: 100,
});
console.log(`  After edit  (B.maxMiles=75, B.rate=$1.80): $${afterMaxMilesEdit.estimatedPrice.toFixed(2)} (expected $233.75)`);
const afterMaxMilesPass = afterMaxMilesEdit.estimatedPrice === 233.75;

// Simulate the admin editing the B.perMileRate input from $1.80 → $2.50.
// Back to original maxMiles=50, but with a steeper B rate:
//   A: 25 × $2.00 = $50.00
//   B: 25 × $2.50 = $62.50
//   C: 50 × $1.75 = $87.50
//   Subtotal: $200.00 + base $50 = $250.00
const afterRateEdit = calculatePricing({
  config: {
    ...prodLikeConfig,
    categoryRules: [
      prodLikeConfig.categoryRules[0],
      { ...prodLikeConfig.categoryRules[1], perMileRate: 2.50 },  // ← edited
      prodLikeConfig.categoryRules[2],
    ],
  },
  distanceMiles: 100,
});
console.log(`  After edit  (B.maxMiles=50, B.rate=$2.50): $${afterRateEdit.estimatedPrice.toFixed(2)} (expected $250.00)`);
const afterRatePass = afterRateEdit.estimatedPrice === 250.00;

// Simulate the admin editing the baseFee from $50 → $100.
// Distance charges are unchanged, but baseFee doubles:
//   $182.50 (distance) + $100 (new base) = $282.50
const afterBaseFeeEdit = calculatePricing({
  config: { ...prodLikeConfig, baseFee: 100 },
  distanceMiles: 100,
});
console.log(`  After edit  (baseFee $50→$100):           $${afterBaseFeeEdit.estimatedPrice.toFixed(2)} (expected $282.50)`);
const afterBaseFeePass = afterBaseFeeEdit.estimatedPrice === 282.50;

const dynamicPass = beforePass && afterMaxMilesPass && afterRatePass && afterBaseFeePass;
console.log(dynamicPass ? '\nDYNAMIC INPUT: PASS' : '\nDYNAMIC INPUT: FAIL');

process.exit(allPassed && bandsPass && dynamicPass ? 0 : 1);

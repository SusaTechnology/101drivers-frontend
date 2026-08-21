// Quick sanity check for the home-page flat-rate quote module.
// Run: npx tsx src/lib/pricing/home-flat-quote.test.ts
//
// (Not a vitest test — same convention as calculate.test.ts.)

import { calculateHomeFlatQuote, HOME_FLAT_QUOTE_CONFIG } from './home-flat-quote';

const { baseFee, flatMiles, perMileRate } = HOME_FLAT_QUOTE_CONFIG;

function round2(n: number): number {
  return Number(n.toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────
// Expected values derived directly from the formula:
//   total = baseFee + max(0, miles − flatMiles) × perMileRate
// ─────────────────────────────────────────────────────────────────────
const cases: Array<{ miles: number; expected: number; label: string }> = [
  // 0 miles — flat fee only
  { miles: 0,  expected: round2(baseFee),                              label: 'zero distance'              },
  // Inside the flat allowance — flat fee only
  { miles: 10, expected: round2(baseFee),                              label: 'within flat allowance'      },
  // Exactly at the boundary — flat fee only (no extra charge)
  { miles: 25, expected: round2(baseFee),                              label: 'exactly at flat allowance'  },
  // One mile over the allowance — flat + 1 × rate
  { miles: 26, expected: round2(baseFee + 1 * perMileRate),           label: 'one mile over allowance'    },
  // 50 miles — flat + 25 × rate
  { miles: 50, expected: round2(baseFee + 25 * perMileRate),          label: '50 miles'                    },
  // 100 miles — flat + 75 × rate
  { miles: 100, expected: round2(baseFee + 75 * perMileRate),         label: '100 miles'                   },
  // 200 miles — flat + 175 × rate
  { miles: 200, expected: round2(baseFee + 175 * perMileRate),        label: '200 miles'                   },
];

let allPassed = true;

console.log('=== formula verification ===');
for (const c of cases) {
  const r = calculateHomeFlatQuote(c.miles);
  const ok = r.estimatedPrice === c.expected;
  if (!ok) allPassed = false;
  console.log(
    `${ok ? '✓' : '✗'} ${c.label.padEnd(30)} @ ${c.miles.toString().padStart(3)} mi -> got $${r.estimatedPrice}, expected $${c.expected}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Verify the hardcoded production values produce the user-documented
// example: 50 miles → $146.00  (= $101 + 25 × $1.80)
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== production-value spot check (50 mi → $146.00) ===');
const fiftyMi = calculateHomeFlatQuote(50);
const fiftyOk = fiftyMi.estimatedPrice === 146;
if (!fiftyOk) allPassed = false;
console.log(
  `${fiftyOk ? '✓' : '✗'} 50 mi -> $${fiftyMi.estimatedPrice.toFixed(2)} (expected $146.00)`
);
console.log(`   baseFare=$${fiftyMi.feesBreakdown.baseFare}`);
console.log(`   flatMilesAllowance=${fiftyMi.feesBreakdown.flatMilesAllowance}`);
console.log(`   billedMiles=${fiftyMi.feesBreakdown.billedMiles}`);
console.log(`   perMileRate=$${fiftyMi.feesBreakdown.perMileRate.toFixed(2)}`);
console.log(`   distanceCharge=$${fiftyMi.feesBreakdown.distanceCharge.toFixed(2)}`);
console.log(`   formula.expression=${fiftyMi.formula.expression}`);

// ─────────────────────────────────────────────────────────────────────
// Rounding behavior: decimal miles should round to nearest whole mile
// so the customer-facing math reconciles with the "X miles" badge.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== rounding behavior ===');
const roundingCases: Array<{ in: number; expectedMiles: number; expectedPrice: number; label: string }> = [
  { in: 24.4, expectedMiles: 24, expectedPrice: round2(baseFee),                            label: '24.4 mi rounds down to 24 (within allowance)' },
  { in: 24.6, expectedMiles: 25, expectedPrice: round2(baseFee),                            label: '24.6 mi rounds up to 25 (still flat)'         },
  { in: 25.4, expectedMiles: 25, expectedPrice: round2(baseFee),                            label: '25.4 mi rounds down to 25 (still flat)'       },
  { in: 25.6, expectedMiles: 26, expectedPrice: round2(baseFee + 1 * perMileRate),         label: '25.6 mi rounds up to 26 (1 billed mile)'      },
];
for (const c of roundingCases) {
  const r = calculateHomeFlatQuote(c.in);
  const milesOk = r.distanceMiles === c.expectedMiles;
  const priceOk = r.estimatedPrice === c.expectedPrice;
  const ok = milesOk && priceOk;
  if (!ok) allPassed = false;
  console.log(
    `${ok ? '✓' : '✗'} ${c.label.padEnd(50)} -> ${r.distanceMiles} mi, $${r.estimatedPrice} (expected ${c.expectedMiles} mi, $${c.expectedPrice})`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Edge cases: negative / NaN / Infinity must throw
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== edge cases (must throw) ===');

function expectThrows(label: string, fn: () => unknown): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) { allPassed = false; console.log(`✗ ${label}: did NOT throw`); }
  else        { console.log(`✓ ${label}: threw as expected`); }
}

expectThrows('negative distance',       () => calculateHomeFlatQuote(-1));
expectThrows('NaN distance',            () => calculateHomeFlatQuote(NaN));
expectThrows('Infinity distance',       () => calculateHomeFlatQuote(Infinity));
expectThrows('-Infinity distance',     () => calculateHomeFlatQuote(-Infinity));

// ─────────────────────────────────────────────────────────────────────
// Shape verification: every required field is present and correctly typed
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== result shape verification ===');
const sample = calculateHomeFlatQuote(75);
const shapeOk =
  typeof sample.distanceMiles === 'number' &&
  typeof sample.estimatedPrice === 'number' &&
  typeof sample.feesBreakdown === 'object' && sample.feesBreakdown !== null &&
  typeof sample.feesBreakdown.baseFare === 'number' &&
  typeof sample.feesBreakdown.flatMilesAllowance === 'number' &&
  typeof sample.feesBreakdown.billedMiles === 'number' &&
  typeof sample.feesBreakdown.perMileRate === 'number' &&
  typeof sample.feesBreakdown.distanceCharge === 'number' &&
  typeof sample.feesBreakdown.total === 'number' &&
  typeof sample.formula === 'object' && sample.formula !== null &&
  typeof sample.formula.description === 'string' &&
  typeof sample.formula.expression === 'string' &&
  typeof sample.formula.label === 'string' &&
  sample.feesBreakdown.total === sample.estimatedPrice;
if (!shapeOk) allPassed = false;
console.log(`${shapeOk ? '✓' : '✗'} result shape is correct`);

// ─────────────────────────────────────────────────────────────────────
// Formula expression contains the actual substituted values
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== formula expression substitution ===');
const exprOk =
  sample.formula.expression.includes(`$${baseFee}`) &&
  sample.formula.expression.includes(`${75}`) &&           // miles
  sample.formula.expression.includes(`${flatMiles}`) &&    // flat allowance
  sample.formula.expression.includes(`$${perMileRate.toFixed(2)}`) &&
  sample.formula.expression.includes(`$${sample.estimatedPrice.toFixed(2)}`);
if (!exprOk) allPassed = false;
console.log(`${exprOk ? '✓' : '✗'} formula expression contains substituted values`);
console.log(`   expression: ${sample.formula.expression}`);
console.log(`   description: ${sample.formula.description}`);

console.log(allPassed ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allPassed ? 0 : 1);

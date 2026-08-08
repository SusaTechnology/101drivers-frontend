// Quick sanity check for the shared pricing utility.
// Run: npx tsx /home/z/my-project/repo/src/lib/pricing/calculate.test.ts

import { calculatePricing } from './calculate';

const abcBands = [
  { minMiles: 0, maxMiles: 25, perMileRate: 2.0 },
  { minMiles: 25, maxMiles: 50, perMileRate: 1.8 },
  { minMiles: 50, maxMiles: null, perMileRate: 1.75 },
];

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
  const r =
    c.mode === 'ABC'
      ? calculatePricing({
          pricingMode: 'CATEGORY_ABC',
          baseFee: 50,
          categoryRules: abcBands,
          distanceMiles: c.miles,
        })
      : calculatePricing({
          pricingMode: 'PER_MILE',
          baseFee: 101,
          flatMiles: 25,
          perMileRate: 1.8,
          distanceMiles: c.miles,
        });

  const ok = r.total === c.expected;
  if (!ok) allPassed = false;
  console.log(
    `${ok ? '✓' : '✗'} ${c.mode} @ ${c.miles} mi -> got $${r.total}, expected $${c.expected}` +
      (ok ? '' : ` [base=$${r.baseFare} dist=$${r.distanceCharge}]`),
  );
}

console.log(allPassed ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allPassed ? 0 : 1);

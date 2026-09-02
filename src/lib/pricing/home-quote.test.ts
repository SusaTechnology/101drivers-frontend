// Quick sanity check for the home-quote adapter.
// Run: npx tsx src/lib/pricing/home-quote.test.ts
//
// (Not a vitest test — same convention as calculate.test.ts and
// home-flat-quote.test.ts.)
//
// Verifies:
//   1. The fallback path (liveConfig = null) produces the SAME numbers
//      as the legacy calculateHomeFlatQuote — so the home page behaves
//      identically when the public pricing endpoint is unreachable.
//   2. The live-config path correctly uses admin-configured values
//      (different from the hard-coded fallback).
//   3. The advertised-rate summary adapts to the live config.

import {
  calculateHomeQuote,
  getAdvertisedRateSummary,
} from './home-quote';
import { calculateHomeFlatQuote, HOME_FLAT_QUOTE_CONFIG } from './home-flat-quote';
import type { PublicPricingConfig } from '@/types/publicPricing';

let allPassed = true;
function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) allPassed = false;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─────────────────────────────────────────────────────────────────────
// 1. FALLBACK PARITY — calculateHomeQuote(null) must equal
//    calculateHomeFlatQuote() for every distance.
// ─────────────────────────────────────────────────────────────────────
console.log('=== fallback parity (liveConfig=null vs legacy calculateHomeFlatQuote) ===');
for (const miles of [0, 5, 25, 26, 50, 100, 250]) {
  const adapter = calculateHomeQuote(miles, null);
  const legacy = calculateHomeFlatQuote(miles);
  const ok =
    adapter.estimatedPrice === legacy.estimatedPrice &&
    adapter.feesBreakdown.baseFare === legacy.feesBreakdown.baseFare &&
    adapter.feesBreakdown.distanceCharge === legacy.feesBreakdown.distanceCharge &&
    adapter.feesBreakdown.total === legacy.feesBreakdown.total &&
    adapter.feesBreakdown.flatMilesAllowance === legacy.feesBreakdown.flatMilesAllowance &&
    adapter.feesBreakdown.billedMiles === legacy.feesBreakdown.billedMiles &&
    adapter.feesBreakdown.perMileRate === legacy.feesBreakdown.perMileRate;
  check(
    `${miles} mi fallback matches legacy`,
    ok,
    `adapter=$${adapter.estimatedPrice} legacy=$${legacy.estimatedPrice}`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. LIVE PER_MILE CONFIG — uses admin values, not the fallback.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== live PER_MILE config (admin override) ===');
const livePerMile: PublicPricingConfig = {
  pricingMode: 'PER_MILE',
  baseFee: 150,          // admin changed $101 → $150
  flatMiles: 30,         // admin changed 25 → 30
  perMileRate: 2.5,      // admin changed $1.80 → $2.50
  insuranceFee: 8,
  transactionFeePct: 2.9,
  transactionFeeFixed: 3,
  feePassThrough: true,
  tierBands: [],
  updatedAt: new Date().toISOString(),
};

const live50 = calculateHomeQuote(50, livePerMile);
// Expected: 150 + max(0, 50-30) × 2.5 = 150 + 50 = 200
// Plus insurance 8 = 208 subtotal
// Plus transaction 3 + 2.9% × 208 = 3 + 6.032 = 9.032 → 9.03
// Total = 208 + 9.03 = 217.03
check(
  'live PER_MILE 50mi uses admin baseFee',
  live50.feesBreakdown.baseFare === 150,
  `baseFare=$${live50.feesBreakdown.baseFare}`,
);
check(
  'live PER_MILE 50mi uses admin flatMiles',
  live50.feesBreakdown.flatMilesAllowance === 30,
  `flatMilesAllowance=${live50.feesBreakdown.flatMilesAllowance}`,
);
check(
  'live PER_MILE 50mi uses admin perMileRate',
  live50.feesBreakdown.perMileRate === 2.5,
  `perMileRate=$${live50.feesBreakdown.perMileRate}`,
);
check(
  'live PER_MILE 50mi bills 20 extra miles (50-30)',
  live50.feesBreakdown.billedMiles === 20,
  `billedMiles=${live50.feesBreakdown.billedMiles}`,
);
check(
  'live PER_MILE 50mi distance charge = 20 × 2.5 = 50',
  live50.feesBreakdown.distanceCharge === 50,
  `distanceCharge=$${live50.feesBreakdown.distanceCharge}`,
);
check(
  'live PER_MILE 50mi total includes fees (≠ fallback $146)',
  live50.estimatedPrice !== 146 && live50.estimatedPrice === 217.03,
  `total=$${live50.estimatedPrice}`,
);

// ─────────────────────────────────────────────────────────────────────
// 3. CATEGORY_ABC CONFIG — LANDING PAGE STAYS FLAT.
// The landing-page contract is: ALWAYS flat-rate, never tiered.
// If a CATEGORY_ABC config somehow reaches the frontend (defensive —
// the backend should return null for ABC), the adapter MUST fall back
// to HOME_FLAT_QUOTE_CONFIG, NOT compute tiered pricing.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== CATEGORY_ABC config (landing page stays flat) ===');
const liveAbc: PublicPricingConfig = {
  pricingMode: 'CATEGORY_ABC',
  baseFee: 50,
  flatMiles: null,
  perMileRate: null,
  insuranceFee: 0,
  transactionFeePct: null,
  transactionFeeFixed: null,
  feePassThrough: false,
  tierBands: [
    { category: 'A', minMiles: 0,  maxMiles: 25,  perMileRate: 2.0 },
    { category: 'B', minMiles: 25, maxMiles: 50,  perMileRate: 1.8 },
    { category: 'C', minMiles: 50, maxMiles: null, perMileRate: 1.75 },
  ],
  updatedAt: new Date().toISOString(),
};

const abc100 = calculateHomeQuote(100, liveAbc);
const legacy100 = calculateHomeFlatQuote(100);
check(
  'CATEGORY_ABC 100mi falls back to flat (NOT tiered $232.50)',
  abc100.estimatedPrice !== 232.5,
  `total=$${abc100.estimatedPrice} (tiered would be $232.50)`,
);
check(
  'CATEGORY_ABC 100mi matches fallback flat total',
  abc100.estimatedPrice === legacy100.estimatedPrice,
  `adapter=$${abc100.estimatedPrice} legacy=$${legacy100.estimatedPrice}`,
);
check(
  'CATEGORY_ABC formula label stays "Flat Rate"',
  abc100.formula.label === 'Flat Rate',
  `label=${abc100.formula.label}`,
);

// ─────────────────────────────────────────────────────────────────────
// 4. ADVERTISED RATE SUMMARY — adapts to live config.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== advertised rate summary ===');

const fallbackSummary = getAdvertisedRateSummary(null);
check(
  'fallback summary uses HOME_FLAT_QUOTE_CONFIG values',
  fallbackSummary.baseFee === HOME_FLAT_QUOTE_CONFIG.baseFee &&
    fallbackSummary.flatMiles === HOME_FLAT_QUOTE_CONFIG.flatMiles &&
    fallbackSummary.perMileRate === HOME_FLAT_QUOTE_CONFIG.perMileRate,
  `baseFee=$${fallbackSummary.baseFee} flatMiles=${fallbackSummary.flatMiles} perMileRate=$${fallbackSummary.perMileRate}`,
);

const livePerMileSummary = getAdvertisedRateSummary(livePerMile);
check(
  'live PER_MILE summary uses admin values',
  livePerMileSummary.baseFee === 150 &&
    livePerMileSummary.flatMiles === 30 &&
    livePerMileSummary.perMileRate === 2.5,
  `baseFee=$${livePerMileSummary.baseFee} flatMiles=${livePerMileSummary.flatMiles} perMileRate=$${livePerMileSummary.perMileRate}`,
);
check(
  'live PER_MILE summary description contains admin values',
  livePerMileSummary.description.includes('$150') &&
    livePerMileSummary.description.includes('30 miles') &&
    livePerMileSummary.description.includes('$2.50'),
  `description="${livePerMileSummary.description}"`,
);

const liveAbcSummary = getAdvertisedRateSummary(liveAbc);
// Landing-page contract: ABC config falls back to flat-rate wording.
check(
  'CATEGORY_ABC summary falls back to flat-rate wording (NOT "tiered")',
  !liveAbcSummary.description.toLowerCase().includes('tiered') &&
    liveAbcSummary.description.toLowerCase().includes('flat rate'),
  `description="${liveAbcSummary.description}"`,
);
check(
  'CATEGORY_ABC summary uses HOME_FLAT_QUOTE_CONFIG values',
  liveAbcSummary.baseFee === HOME_FLAT_QUOTE_CONFIG.baseFee &&
    liveAbcSummary.flatMiles === HOME_FLAT_QUOTE_CONFIG.flatMiles &&
    liveAbcSummary.perMileRate === HOME_FLAT_QUOTE_CONFIG.perMileRate,
  `baseFee=$${liveAbcSummary.baseFee} flatMiles=${liveAbcSummary.flatMiles} perMileRate=$${liveAbcSummary.perMileRate}`,
);

// ─────────────────────────────────────────────────────────────────────
// 5. EDGE CASES — must throw on bad input.
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== edge cases (must throw) ===');
function expectThrows(label: string, fn: () => unknown): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) { allPassed = false; console.log(`✗ ${label}: did NOT throw`); }
  else        { console.log(`✓ ${label}: threw as expected`); }
}
expectThrows('negative distance',   () => calculateHomeQuote(-1, null));
expectThrows('NaN distance',        () => calculateHomeQuote(NaN, null));
expectThrows('Infinity distance',   () => calculateHomeQuote(Infinity, null));
expectThrows('-Infinity distance',  () => calculateHomeQuote(-Infinity, null));

console.log(allPassed ? '\nALL PASS' : '\nSOME FAILED');
process.exit(allPassed ? 0 : 1);

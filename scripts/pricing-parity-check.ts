/**
 * Frontend↔Backend pricing parity check.
 *
 * Runs the FRONTEND calculatePricing (src/lib/pricing/calculate.ts) and an
 * inline transcription of the BACKEND PricingEngineService.computeQuoteFromConfig
 * (backend/src/delivery-logistics/pricing-engine.service.ts lines 217-350)
 * against identical inputs, and asserts every output field matches to the cent.
 *
 * The backend transcription below is a faithful copy of the backend code:
 * same Number(x.toFixed(2)) rounding, same prevUpper band logic, same fee math.
 */
import {
  calculatePricing,
  type PricingCalcConfig,
} from '../src/lib/pricing/calculate';

// ─── Backend math, transcribed 1:1 from computeQuoteFromConfig ───
type BackendRule = {
  category: string;
  minMiles: number;
  maxMiles: number | null;
  perMileRate: number | null;
};
type BackendConfig = {
  id: string;
  pricingMode: 'PER_MILE' | 'CATEGORY_ABC' | 'FLAT_TIER';
  baseFee: number | null;
  flatMiles: number | null;
  perMileRate: number | null;
  insuranceFee: number | null;
  transactionFeeFixed: number | null;
  transactionFeePct: number | null;
  feePassThrough: boolean;
  driverSharePct: number | null;
  categoryRules: BackendRule[];
};

function backendResolveEffectiveMode(
  override: string | null,
  configMode: BackendConfig['pricingMode'],
): 'PER_MILE' | 'CATEGORY_ABC' {
  if (override != null) {
    if (override === 'PER_MILE' || override === 'FLAT_TIER') return 'PER_MILE';
    return 'CATEGORY_ABC';
  }
  if (configMode === 'PER_MILE' || configMode === 'FLAT_TIER') return 'PER_MILE';
  return 'CATEGORY_ABC';
}

function backendComputeQuoteFromConfig(input: {
  config: BackendConfig;
  distanceMiles: number;
  customerPricingModeOverride: string | null;
}): {
  estimatedPrice: number;
  baseFare: number;
  distanceCharge: number;
  insuranceFee: number;
  transactionFee: number;
  billedMiles: number | null;
  estimatedDriverPayout: number;
} {
  const { config, distanceMiles } = input;
  const effectiveMode = backendResolveEffectiveMode(
    input.customerPricingModeOverride,
    config.pricingMode,
  );

  let baseFare = 0;
  let distanceCharge = 0;

  if (effectiveMode === 'PER_MILE') {
    if (config.perMileRate == null) throw new Error('missing perMileRate');
    const flatMilesAllowance = Number(config.flatMiles ?? 0);
    const billableMiles = Number(
      Math.max(0, distanceMiles - flatMilesAllowance).toFixed(4)
    );
    baseFare = Number((config.baseFee ?? 0).toFixed(2));
    distanceCharge = Number((billableMiles * config.perMileRate).toFixed(2));
  } else {
    baseFare = Number((config.baseFee ?? 0).toFixed(2));
    const sortedRules = [...config.categoryRules].sort(
      (a, b) => a.minMiles - b.minMiles
    );
    if (sortedRules.length === 0) throw new Error('no ABC rules');
    let prevUpper = 0;
    for (const rule of sortedRules) {
      const lower = prevUpper;
      const upper = rule.maxMiles == null ? Infinity : Number(rule.maxMiles);
      const milesInBand = Math.max(0, Math.min(distanceMiles, upper) - lower);
      const rate = Number(rule.perMileRate ?? 0);
      distanceCharge = Number(
        (distanceCharge + milesInBand * rate).toFixed(2)
      );
      prevUpper = upper;
    }
  }

  const insuranceFee = Number((config.insuranceFee ?? 0).toFixed(2));
  const subTotal = Number((baseFare + distanceCharge + insuranceFee).toFixed(2));
  const transactionFeeFixed = Number((config.transactionFeeFixed ?? 0).toFixed(2));
  const transactionFeePctRate = Number((config.transactionFeePct ?? 0).toFixed(2));
  const transactionFeePctAmount = Number(
    (((config.transactionFeePct ?? 0) / 100) * subTotal).toFixed(2)
  );
  const transactionFee = config.feePassThrough
    ? Number((transactionFeeFixed + transactionFeePctAmount).toFixed(2))
    : 0;
  const estimatedPrice = Number((subTotal + transactionFee).toFixed(2));

  const driverSharePct = config.driverSharePct ?? 60;
  const driverShareAmount = Number(
    (estimatedPrice * (driverSharePct / 100)).toFixed(2)
  );
  const estimatedDriverPayout = Number(
    Math.max(driverShareAmount - insuranceFee, 0).toFixed(2)
  );

  return {
    estimatedPrice,
    baseFare,
    distanceCharge,
    insuranceFee,
    transactionFee,
    billedMiles:
      effectiveMode === 'PER_MILE'
        ? Number(
            Math.max(0, distanceMiles - (config.flatMiles ?? 0)).toFixed(2)
          )
        : null,
    estimatedDriverPayout,
  };
}

// ─── Test cases ───
function toFrontendConfig(b: BackendConfig): PricingCalcConfig {
  return {
    id: b.id,
    pricingMode: b.pricingMode,
    baseFee: b.baseFee ?? 0,
    flatMiles: b.flatMiles,
    perMileRate: b.perMileRate,
    insuranceFee: b.insuranceFee ?? 0,
    transactionFeePct: b.transactionFeePct,
    transactionFeeFixed: b.transactionFeeFixed,
    feePassThrough: b.feePassThrough,
    driverSharePct: b.driverSharePct ?? 60,
    tiers: [],
    categoryRules: b.categoryRules.map((r) => ({
      category: r.category as 'A' | 'B' | 'C',
      minMiles: r.minMiles,
      maxMiles: r.maxMiles,
      baseFee: null,
      flatPrice: null,
      perMileRate: r.perMileRate,
    })),
  };
}

const flatConfig: BackendConfig = {
  id: 'cfg-flat',
  pricingMode: 'PER_MILE',
  baseFee: 101,
  flatMiles: 25,
  perMileRate: 1.8,
  insuranceFee: 0,
  transactionFeeFixed: null,
  transactionFeePct: null,
  feePassThrough: false,
  driverSharePct: 60,
  categoryRules: [],
};

const flatWithFees: BackendConfig = {
  ...flatConfig,
  id: 'cfg-flat-fees',
  insuranceFee: 2.5,
  transactionFeeFixed: 0.3,
  transactionFeePct: 2.9,
  feePassThrough: true,
};

const abcConfig: BackendConfig = {
  id: 'cfg-abc',
  pricingMode: 'CATEGORY_ABC',
  baseFee: 50,
  flatMiles: null,
  perMileRate: null,
  insuranceFee: 1,
  transactionFeeFixed: 0.3,
  transactionFeePct: 2.9,
  feePassThrough: true,
  driverSharePct: 70,
  categoryRules: [
    { category: 'A', minMiles: 0, maxMiles: 25, perMileRate: 2.0 },
    { category: 'B', minMiles: 25.01, maxMiles: 75, perMileRate: 1.8 },
    { category: 'C', minMiles: 75.01, maxMiles: null, perMileRate: 1.75 },
  ],
};

const distances = [0, 5, 15, 25, 25.4, 30, 50, 74.9, 75, 100, 148.37];
const overrides: Array<string | null> = [null, 'PER_MILE', 'CATEGORY_ABC'];

let pass = 0;
let fail = 0;

for (const cfg of [flatConfig, flatWithFees, abcConfig]) {
  for (const miles of distances) {
    for (const override of overrides) {
      // Frontend
      let fe: ReturnType<typeof calculatePricing> | null = null;
      let feThrew = false;
      try {
        fe = calculatePricing({
          config: toFrontendConfig(cfg),
          distanceMiles: miles,
          customerPricingModeOverride: override as never,
        });
      } catch {
        feThrew = true;
      }
      // Backend (transcribed)
      let be: ReturnType<typeof backendComputeQuoteFromConfig> | null = null;
      let beThrew = false;
      try {
        be = backendComputeQuoteFromConfig({
          config: cfg,
          distanceMiles: miles,
          customerPricingModeOverride: override,
        });
      } catch {
        beThrew = true;
      }

      // Both throwing (e.g. ABC override on a PER_MILE config with no
      // categoryRules) is parity — both surfaces reject the same input.
      if (feThrew || beThrew) {
        if (feThrew && beThrew) {
          pass++;
          continue;
        }
        fail++;
        console.log(
          `✗ THROW MISMATCH [${cfg.id}] ${miles}mi override=${override}: FE threw=${feThrew} BE threw=${beThrew}`
        );
        continue;
      }

      const diffs: string[] = [];
      if (fe.estimatedPrice !== be.estimatedPrice)
        diffs.push(`price FE=${fe.estimatedPrice} BE=${be.estimatedPrice}`);
      if (fe.feesBreakdown.baseFare !== be.baseFare)
        diffs.push(`baseFare FE=${fe.feesBreakdown.baseFare} BE=${be.baseFare}`);
      if (fe.feesBreakdown.distanceCharge !== be.distanceCharge)
        diffs.push(
          `distCharge FE=${fe.feesBreakdown.distanceCharge} BE=${be.distanceCharge}`
        );
      if (fe.feesBreakdown.insuranceFee !== be.insuranceFee)
        diffs.push(`insFee FE=${fe.feesBreakdown.insuranceFee} BE=${be.insuranceFee}`);
      if (fe.feesBreakdown.transactionFee !== be.transactionFee)
        diffs.push(`txnFee FE=${fe.feesBreakdown.transactionFee} BE=${be.transactionFee}`);
      if (
        be.billedMiles != null &&
        fe.feesBreakdown.billedMiles != null &&
        Math.abs(fe.feesBreakdown.billedMiles - be.billedMiles) > 0.005
      )
        diffs.push(`billedMiles FE=${fe.feesBreakdown.billedMiles} BE=${be.billedMiles}`);
      if (fe.estimatedDriverPayout !== be.estimatedDriverPayout)
        diffs.push(
          `payout FE=${fe.estimatedDriverPayout} BE=${be.estimatedDriverPayout}`
        );

      if (diffs.length === 0) {
        pass++;
      } else {
        fail++;
        console.log(
          `✗ MISMATCH [${cfg.id}] ${miles}mi override=${override}: ${diffs.join('; ')}`
        );
      }
    }
  }
}

console.log(
  `\nParity check: ${pass} passed, ${fail} failed ` +
    `(3 configs × ${distances.length} distances × ${overrides.length} overrides)`
);
process.exit(fail > 0 ? 1 : 0);

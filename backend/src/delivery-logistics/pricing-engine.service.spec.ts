/**
 * Unit tests for PricingEngineService.previewQuote (Item 5 — Preview Quote endpoint).
 *
 * Verifies the TWO supported pricing models:
 *   1. ABC (CATEGORY_ABC) — progressive tiered (tax-bracket style):
 *        total = baseFee + Σ(band_miles × band_rate)
 *      where bands are categoryRules sorted by minMiles. Each band contributes
 *      max(0, min(miles, maxMiles ?? ∞) − prevBandMax) × perMileRate.
 *      With seed (baseFee=50, A:0-25@$2, B:25-50@$1.80, C:50+@$1.75):
 *        15 mi → $80, 25 mi → $100, 50 mi → $145, 100 mi → $232.50
 *   2. Flat (PER_MILE) — flat fee + extra mileage:
 *        total = baseFee + max(0, miles − flatMiles) × perMileRate
 *
 * DEPRECATED: FLAT_TIER mode is no longer creatable via the admin UI and the
 * calc branch has been removed. resolveEffectiveMode still remaps any legacy
 * FLAT_TIER config/override to PER_MILE so historical snapshots resolve. The
 * legacy tests below verify that remap behavior.
 */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PricingEngineService } from "./pricing-engine.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockPrisma = any;

const CONFIG_ID = "cfg_test_001";

const makePerMileConfig = () => ({
  id: CONFIG_ID,
  active: true,
  isDefault: false,
  baseFee: 100,
  insuranceFee: 8,
  driverSharePct: 60,
  feePassThrough: true,
  flatMiles: 50,
  perMileRate: 2,
  pricingMode: "PER_MILE" as const,
  transactionFeeFixed: 3,
  transactionFeePct: 2.9,
  tiers: [],
  categoryRules: [],
});

const makeFlatTierConfig = () => ({
  id: CONFIG_ID,
  active: true,
  isDefault: false,
  baseFee: 100,
  insuranceFee: 8,
  driverSharePct: 60,
  feePassThrough: true,
  flatMiles: null,
  perMileRate: null,
  pricingMode: "FLAT_TIER" as const,
  transactionFeeFixed: 3,
  transactionFeePct: 2.9,
  tiers: [
    { id: "t1", minMiles: 0, maxMiles: 25, flatPrice: 120 },
    { id: "t2", minMiles: 25.01, maxMiles: 75, flatPrice: 180 },
    { id: "t3", minMiles: 75.01, maxMiles: null, flatPrice: 260 },
  ],
  categoryRules: [],
});

// ABC config uses the SEED values confirmed by the product spec:
//   baseFee=50, A:0-25 @ $2.00, B:25-50 @ $1.80, C:50+ @ $1.75
// Per-rule baseFee/flatPrice are intentionally null — the progressive
// tiered formula uses ONLY config.baseFee + Σ(band miles × band rate).
const makeCategoryAbcConfig = () => ({
  id: CONFIG_ID,
  active: true,
  isDefault: false,
  baseFee: 50,
  insuranceFee: 8,
  driverSharePct: 60,
  feePassThrough: true,
  flatMiles: null,
  perMileRate: null,
  pricingMode: "CATEGORY_ABC" as const,
  transactionFeeFixed: 3,
  transactionFeePct: 2.9,
  tiers: [],
  categoryRules: [
    {
      id: "r1",
      category: "A",
      minMiles: 0,
      maxMiles: 25,
      baseFee: null,
      perMileRate: 2.0,
      flatPrice: null,
    },
    {
      id: "r2",
      category: "B",
      minMiles: 25,
      maxMiles: 50,
      baseFee: null,
      perMileRate: 1.8,
      flatPrice: null,
    },
    {
      id: "r3",
      category: "C",
      minMiles: 50,
      maxMiles: null,
      baseFee: null,
      perMileRate: 1.75,
      flatPrice: null,
    },
  ],
});

const makeMockPrisma = (config: unknown): MockPrisma => ({
  pricingConfig: {
    findUnique: jest.fn(async () => config),
  },
});

describe("PricingEngineService.previewQuote", () => {
  let service: PricingEngineService;

  it("throws NotFoundException when config does not exist", async () => {
    const prisma = makeMockPrisma(null);
    service = new PricingEngineService(prisma);
    await expect(
      service.previewQuote({
        pricingConfigId: "nope",
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws BadRequestException on negative distance", async () => {
    const prisma = makeMockPrisma(makePerMileConfig());
    service = new PricingEngineService(prisma);
    await expect(
      service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: -1,
        serviceType: "STANDARD" as any,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe("PER_MILE", () => {
    it("50mi with flatMiles=50 → baseFee only, no per-mile charge", async () => {
      const prisma = makeMockPrisma(makePerMileConfig());
      service = new PricingEngineService(prisma);

      // Hand-computed:
      // billableMiles = max(0, 50 - 50) = 0
      // baseFare = 100, distanceCharge = 0
      // subTotal = 100 + 0 + 8 = 108
      // transactionFee = 3 + 108 * 0.029 = 3 + 3.13 = 6.13
      // estimatedPrice = 108 + 6.13 = 114.13
      // driverShareAmount = 114.13 * 0.6 = 68.48
      // estimatedDriverPayout = max(68.48 - 8, 0) = 60.48
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      });

      expect(result.estimatedPrice).toBe(114.13);
      expect(result.estimatedDriverPayout).toBe(60.48);
      expect(result.feesBreakdown.billedMiles).toBe(0);
      expect(result.feesBreakdown.flatMilesAllowance).toBe(50);
      expect(result.pricingMode).toBe("PER_MILE");
      expect(result.mileageCategory).toBeNull();
    });

    it("75mi with flatMiles=50 → 25 billable miles", async () => {
      const prisma = makeMockPrisma(makePerMileConfig());
      service = new PricingEngineService(prisma);

      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 75,
        serviceType: "STANDARD" as any,
      });

      // billableMiles = 25, distanceCharge = 25 * 2 = 50
      // subTotal = 100 + 50 + 8 = 158
      // transactionFee = 3 + 158 * 0.029 = 3 + 4.58 = 7.58
      // estimatedPrice = 158 + 7.58 = 165.58
      // driverShare = 165.58 * 0.6 = 99.35, payout = 99.35 - 8 = 91.35
      expect(result.feesBreakdown.billedMiles).toBe(25);
      expect(result.feesBreakdown.distanceCharge).toBe(50);
      expect(result.estimatedPrice).toBe(165.58);
      expect(result.estimatedDriverPayout).toBe(91.35);
    });

    it("throws when perMileRate is null", async () => {
      const cfg: any = makePerMileConfig();
      cfg.perMileRate = null;
      const prisma = makeMockPrisma(cfg);
      service = new PricingEngineService(prisma);

      await expect(
        service.previewQuote({
          pricingConfigId: CONFIG_ID,
          distanceMiles: 50,
          serviceType: "STANDARD" as any,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("FLAT_TIER (DEPRECATED — legacy remap to PER_MILE)", () => {
    // FLAT_TIER is no longer creatable via the admin UI, but legacy configs
    // may still have pricingMode=FLAT_TIER in the DB. The engine remaps
    // these to PER_MILE at calculation time so the quote still resolves.
    // These tests verify that remap behavior stays intact.

    it("legacy FLAT_TIER config with perMileRate is silently treated as PER_MILE (Flat)", async () => {
      // resolveEffectiveMode maps FLAT_TIER → PER_MILE, so the math is
      // baseFee + max(0, miles − flatMiles) × perMileRate.
      // We synthesize a legacy FLAT_TIER config that happens to have a
      // perMileRate set, so it should resolve cleanly under PER_MILE math.
      const legacy: any = makeFlatTierConfig();
      legacy.flatMiles = 25;
      legacy.perMileRate = 1.8;
      legacy.baseFee = 101;
      const prisma = makeMockPrisma(legacy);
      service = new PricingEngineService(prisma);

      // 50 mi, flatMiles=25 → billedMiles = 25, distanceCharge = 25 × 1.8 = 45
      // subTotal = 101 + 45 + 8 = 154
      // transactionFee = 3 + 154 × 0.029 = 3 + 4.47 = 7.47
      // estimatedPrice = 154 + 7.47 = 161.47
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      });

      // pricingMode in the result reflects the EFFECTIVE mode (PER_MILE),
      // not the legacy schema mode — so downstream code never sees FLAT_TIER.
      expect(result.pricingMode).toBe("PER_MILE");
      expect(result.feesBreakdown.billedMiles).toBe(25);
      expect(result.feesBreakdown.distanceCharge).toBe(45);
      expect(result.estimatedPrice).toBe(161.47);
    });

    it("legacy FLAT_TIER config with null perMileRate throws (would-be PER_MILE requires perMileRate)", async () => {
      const prisma = makeMockPrisma(makeFlatTierConfig());
      service = new PricingEngineService(prisma);

      await expect(
        service.previewQuote({
          pricingConfigId: CONFIG_ID,
          distanceMiles: 50,
          serviceType: "STANDARD" as any,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("CATEGORY_ABC (progressive tiered)", () => {
    it("15mi → only band A applies: 50 + 15×2 = 80 (+fees)", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // baseFare = 50, distanceCharge = 15 × 2.0 = 30
      // subTotal = 50 + 30 + 8 = 88
      // transactionFee = 3 + 88 × 0.029 = 3 + 2.552 = 5.55
      // estimatedPrice = 88 + 5.55 = 93.55
      // driverShare = 93.55 × 0.6 = 56.13, payout = 56.13 − 8 = 48.13
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 15,
        serviceType: "STANDARD" as any,
      });

      expect(result.pricingMode).toBe("CATEGORY_ABC");
      expect(result.mileageCategory).toBe("A");
      expect(result.feesBreakdown.baseFare).toBe(50);
      expect(result.feesBreakdown.distanceCharge).toBe(30);
      expect(result.estimatedPrice).toBe(93.55);
      expect(result.estimatedDriverPayout).toBe(48.13);
    });

    it("25mi → band A full: 50 + 25×2 = 100 (+fees)", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // baseFare = 50, distanceCharge = 25 × 2.0 = 50
      // subTotal = 50 + 50 + 8 = 108
      // transactionFee = 3 + 108 × 0.029 = 3 + 3.132 = 6.13
      // estimatedPrice = 108 + 6.13 = 114.13
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 25,
        serviceType: "STANDARD" as any,
      });

      expect(result.mileageCategory).toBe("A");
      expect(result.feesBreakdown.baseFare).toBe(50);
      expect(result.feesBreakdown.distanceCharge).toBe(50);
      expect(result.estimatedPrice).toBe(114.13);
    });

    it("50mi → bands A + B: 50 + 25×2 + 25×1.8 = 145 (+fees)", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // distanceCharge = 25×2.0 + 25×1.8 = 50 + 45 = 95
      // subTotal = 50 + 95 + 8 = 153
      // transactionFee = 3 + 153 × 0.029 = 3 + 4.437 = 7.44
      // estimatedPrice = 153 + 7.44 = 160.44
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      });

      expect(result.mileageCategory).toBe("B");
      expect(result.feesBreakdown.baseFare).toBe(50);
      expect(result.feesBreakdown.distanceCharge).toBe(95);
      expect(result.estimatedPrice).toBe(160.44);
    });

    it("100mi → bands A + B + C: 50 + 50 + 45 + 87.5 = 232.50 (+fees)", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // distanceCharge = 25×2.0 + 25×1.8 + 50×1.75 = 50 + 45 + 87.5 = 182.5
      // subTotal = 50 + 182.5 + 8 = 240.5
      // transactionFee = 3 + 240.5 × 0.029 = 3 + 6.9745 = 9.97
      // estimatedPrice = 240.5 + 9.97 = 250.47
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 100,
        serviceType: "STANDARD" as any,
      });

      expect(result.mileageCategory).toBe("C");
      expect(result.feesBreakdown.baseFare).toBe(50);
      expect(result.feesBreakdown.distanceCharge).toBe(182.5);
      expect(result.estimatedPrice).toBe(250.47);
    });

    it("categoryOverride='C' is display-only — math stays progressive (10mi still uses band A)", async () => {
      // The new progressive tiered math is purely distance-based; the
      // override only affects which category is REPORTED in the result's
      // mileageCategory field (used for UI display).
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // 10mi with override='C': math still uses band A only (10 × 2.0 = 20).
      // baseFare = 50, distanceCharge = 20, subTotal = 50 + 20 + 8 = 78
      // transactionFee = 3 + 78 × 0.029 = 3 + 2.262 = 5.26
      // estimatedPrice = 78 + 5.26 = 83.26
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 10,
        serviceType: "STANDARD" as any,
        categoryOverride: "C" as any,
      });

      expect(result.mileageCategory).toBe("C"); // override honored for display
      expect(result.feesBreakdown.baseFare).toBe(50); // config baseFee, not per-rule
      expect(result.feesBreakdown.distanceCharge).toBe(20); // 10 × 2.0
      expect(result.estimatedPrice).toBe(83.26);
    });

    it("throws when categoryRules is empty", async () => {
      const cfg = makeCategoryAbcConfig();
      cfg.categoryRules = [];
      const prisma = makeMockPrisma(cfg);
      service = new PricingEngineService(prisma);

      await expect(
        service.previewQuote({
          pricingConfigId: CONFIG_ID,
          distanceMiles: 100,
          serviceType: "STANDARD" as any,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("pricingSnapshot", () => {
    it("snapshot includes pricingConfigId, serviceType, distanceMiles, calculatedAt", async () => {
      const prisma = makeMockPrisma(makePerMileConfig());
      service = new PricingEngineService(prisma);

      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      });

      expect(result.pricingSnapshot.pricingConfigId).toBe(CONFIG_ID);
      expect(result.pricingSnapshot.serviceType).toBe("STANDARD");
      expect(result.pricingSnapshot.distanceMiles).toBe(50);
      expect(result.pricingSnapshot.effectiveMode).toBe("PER_MILE");
      expect(result.pricingSnapshot.customerPricingModeOverride).toBeNull();
      expect(typeof result.pricingSnapshot.calculatedAt).toBe("string");
    });
  });
});

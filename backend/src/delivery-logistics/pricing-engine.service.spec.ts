/**
 * Unit tests for PricingEngineService.previewQuote (Item 5 — Preview Quote endpoint).
 *
 * Verifies:
 *  - Throws NotFoundException when the target PricingConfig doesn't exist.
 *  - Returns the same math as calculateQuote for PER_MILE / FLAT_TIER / CATEGORY_ABC.
 *  - Honors categoryOverride in CATEGORY_ABC mode.
 *  - Throws BadRequestException on negative distance.
 *  - Throws BadRequestException when PER_MILE config has null perMileRate.
 *  - Throws BadRequestException when FLAT_TIER has no matching tier.
 *  - Throws BadRequestException when CATEGORY_ABC has no matching rule.
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

const makeCategoryAbcConfig = () => ({
  id: CONFIG_ID,
  active: true,
  isDefault: false,
  baseFee: 100,
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
      baseFee: 40,
      perMileRate: 3.5,
      flatPrice: null,
    },
    {
      id: "r2",
      category: "B",
      minMiles: 25.01,
      maxMiles: 75,
      baseFee: 55,
      perMileRate: 4.25,
      flatPrice: null,
    },
    {
      id: "r3",
      category: "C",
      minMiles: 75.01,
      maxMiles: null,
      baseFee: 70,
      perMileRate: 5.25,
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

  describe("FLAT_TIER", () => {
    it("30mi falls in 25.01-75 tier → flatPrice 180", async () => {
      const prisma = makeMockPrisma(makeFlatTierConfig());
      service = new PricingEngineService(prisma);

      // baseFare = 180, distanceCharge = 0, subTotal = 188
      // transactionFee = 3 + 188 * 0.029 = 3 + 5.45 = 8.45
      // estimatedPrice = 188 + 8.45 = 196.45
      // mileageCategory at 30mi = B
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 30,
        serviceType: "STANDARD" as any,
      });

      expect(result.pricingMode).toBe("FLAT_TIER");
      expect(result.mileageCategory).toBe("B");
      expect(result.feesBreakdown.baseFare).toBe(180);
      expect(result.feesBreakdown.distanceCharge).toBe(0);
      expect(result.estimatedPrice).toBe(196.45);
    });

    it("throws when no tier matches the distance", async () => {
      const cfg = makeFlatTierConfig();
      cfg.tiers = [{ id: "x", minMiles: 100, maxMiles: 200, flatPrice: 500 }];
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

  describe("CATEGORY_ABC", () => {
    it("15mi → category A, baseFee 40, perMileRate 3.5", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // baseFare = 40, distanceCharge = 15 * 3.5 = 52.5
      // subTotal = 40 + 52.5 + 8 = 100.5
      // transactionFee = 3 + 100.5 * 0.029 = 3 + 2.91 = 5.91
      // estimatedPrice = 100.5 + 5.91 = 106.41
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 15,
        serviceType: "STANDARD" as any,
      });

      expect(result.pricingMode).toBe("CATEGORY_ABC");
      expect(result.mileageCategory).toBe("A");
      expect(result.feesBreakdown.baseFare).toBe(40);
      expect(result.feesBreakdown.distanceCharge).toBe(52.5);
      expect(result.estimatedPrice).toBe(106.41);
    });

    it("50mi → category B", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 50,
        serviceType: "STANDARD" as any,
      });

      expect(result.mileageCategory).toBe("B");
      expect(result.feesBreakdown.baseFare).toBe(55);
    });

    it("100mi → category C", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 100,
        serviceType: "STANDARD" as any,
      });

      expect(result.mileageCategory).toBe("C");
      expect(result.feesBreakdown.baseFare).toBe(70);
    });

    it("categoryOverride='C' forces category C even at 10mi", async () => {
      const prisma = makeMockPrisma(makeCategoryAbcConfig());
      service = new PricingEngineService(prisma);

      // Without override, 10mi → category A (baseFee 40, rate 3.5).
      // With override='C', the math uses category C rule (baseFee 70, rate 5.25):
      //   baseFare = 70, distanceCharge = 10 * 5.25 = 52.5
      //   subTotal = 70 + 52.5 + 8 = 130.5
      //   transactionFee = 3 + 130.5 * 0.029 = 3 + 3.78 = 6.78
      //   estimatedPrice = 130.5 + 6.78 = 137.28
      const result = await service.previewQuote({
        pricingConfigId: CONFIG_ID,
        distanceMiles: 10,
        serviceType: "STANDARD" as any,
        categoryOverride: "C" as any,
      });

      expect(result.mileageCategory).toBe("C");
      expect(result.feesBreakdown.baseFare).toBe(70);
      expect(result.feesBreakdown.distanceCharge).toBe(52.5);
      expect(result.estimatedPrice).toBe(137.28);
    });

    it("throws when no rule matches the resolved category", async () => {
      const cfg = makeCategoryAbcConfig();
      // Remove category C rule, then preview at 100mi
      cfg.categoryRules = cfg.categoryRules.filter(
        (r: any) => r.category !== "C"
      );
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

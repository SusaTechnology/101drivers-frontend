/**
 * V3.1 — the config-driven referral role matrix ("who can refer whom").
 *
 * `referralRoleMatrix` lives INSIDE the referral program settings JSON
 * (AppSettingService — the single source of truth, admin-tunable) and is
 * consumed by:
 *   1. AppSettingService      — defaults, merge-on-read, merge-on-update
 *   2. ReferralService.applyReferral         — hard server-side rejection
 *   3. ReferralService.applyCustomerReferral — hard server-side rejection
 *   4. ReferralService.publicResolveReferralCode — `allows` map that
 *      drives the /test-referral/:code invite-page signup buttons
 *
 * Default policy: drivers and personal customers can refer drivers +
 * personal customers but NOT businesses; business customers (B2B) can
 * refer everyone. Every test here pins a cell of that contract.
 *
 * Heavy Prisma / AppSetting dependencies are mocked with
 * jest-mock-extended's mockDeep — no real DB.
 */
import { BadRequestException } from "@nestjs/common";
import { mockDeep } from "jest-mock-extended";

import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import { AppSettingDomain } from "../domain/appSetting/appSetting.domain";
import { AppSettingPolicyService } from "../domain/appSetting/appSettingPolicy.service";
import { ReferralService } from "./referral.service";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";
import { ReferralRoleMatrix } from "../appSetting/dto/appSetting.dto";

// ── Test config ──────────────────────────────────────────────────────
const DEFAULT_MATRIX: ReferralRoleMatrix = {
  DRIVER: { DRIVER: true, PERSONAL: true, BUSINESS: false },
  PERSONAL: { DRIVER: true, PERSONAL: true, BUSINESS: false },
  BUSINESS: { DRIVER: true, PERSONAL: true, BUSINESS: true },
};

const buildConfig = (matrix: ReferralRoleMatrix = DEFAULT_MATRIX) => ({
  isActive: true,
  rewardTrigger: "ON_DELIVERIES_COMPLETED" as const,
  requiredDeliveries: 30,
  timeLimitMode: "FOREVER" as const,
  windowStartDate: null,
  windowEndDate: null,
  referrerRewardAmount: 150,
  referralThreshold: 20,
  referredGetsReward: false,
  referredRewardAmount: null,
  payoutModel: "PER_DELIVERY" as const,
  perDeliveryReferrerAmountCents: 500,
  perDeliveryPersonalReferrerAmountCents: 500,
  perDeliveryBusinessReferrerAmountCents: 1000,
  perDeliveryDriverReferrerAmountCents: 500,
  perDeliveryReferredBonusCents: 5000,
  perDeliveryBonusTriggerCount: 5,
  referralWindowDays: 30,
  businessReferralAmountCents: 1000,
  businessReferralRollingCapCents: 30000,
  residentialReferralAmountCents: 500,
  customerReferralsEnabled: true,
  driverReferralsEnabled: true,
  referralRoleMatrix: matrix,
});

describe("AppSettingService — referralRoleMatrix config", () => {
  let prisma: ReturnType<typeof mockDeep<PrismaService>>;
  let service: AppSettingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new AppSettingService(
      prisma,
      mockDeep<AppSettingDomain>(),
      mockDeep<AppSettingPolicyService>(),
    );
  });

  it("returns the default matrix when no settings row exists", async () => {
    prisma.appSetting.findUnique.mockResolvedValue(null as any);
    const config = await service.getReferralProgramSettings();
    expect(config.referralRoleMatrix).toEqual(DEFAULT_MATRIX);
  });

  it("merges a partial stored matrix onto the defaults cell-by-cell", async () => {
    // Admin stored ONLY one flipped cell — every other cell must keep
    // the default value, not collapse to undefined/false.
    prisma.appSetting.findUnique.mockResolvedValue({
      key: "REFERRAL_PROGRAM_SETTINGS",
      value: { referralRoleMatrix: { DRIVER: { DRIVER: false } } },
    } as any);
    const config = await service.getReferralProgramSettings();
    expect(config.referralRoleMatrix.DRIVER.DRIVER).toBe(false);
    expect(config.referralRoleMatrix.DRIVER.PERSONAL).toBe(true);
    expect(config.referralRoleMatrix.DRIVER.BUSINESS).toBe(false);
    expect(config.referralRoleMatrix.PERSONAL).toEqual(DEFAULT_MATRIX.PERSONAL);
    expect(config.referralRoleMatrix.BUSINESS).toEqual(DEFAULT_MATRIX.BUSINESS);
  });

  it("falls back to defaults for a corrupt (non-object) stored matrix", async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      key: "REFERRAL_PROGRAM_SETTINGS",
      value: { referralRoleMatrix: "garbage" },
    } as any);
    const config = await service.getReferralProgramSettings();
    expect(config.referralRoleMatrix).toEqual(DEFAULT_MATRIX);
  });

  it("update: partial matrix input merges cell-by-cell onto current values", async () => {
    // Current stored config has DRIVER.DRIVER flipped off already.
    prisma.appSetting.findUnique.mockResolvedValue({
      key: "REFERRAL_PROGRAM_SETTINGS",
      value: buildConfig({
        ...DEFAULT_MATRIX,
        DRIVER: { DRIVER: false, PERSONAL: true, BUSINESS: false },
      }),
    } as any);

    await service.updateReferralProgramSettings({
      referralRoleMatrix: { BUSINESS: { PERSONAL: false } },
    } as any);

    const written = prisma.appSetting.upsert.mock.calls[0][0].update
      .value as ReturnType<typeof buildConfig>;
    // The submitted cell is applied…
    expect(written.referralRoleMatrix.BUSINESS.PERSONAL).toBe(false);
    // …everything not submitted keeps its CURRENT value…
    expect(written.referralRoleMatrix.DRIVER.DRIVER).toBe(false);
    expect(written.referralRoleMatrix.DRIVER.PERSONAL).toBe(true);
    expect(written.referralRoleMatrix.BUSINESS.BUSINESS).toBe(true);
    expect(written.referralRoleMatrix.PERSONAL).toEqual(DEFAULT_MATRIX.PERSONAL);
  });
});

describe("ReferralService — role matrix enforcement on apply", () => {
  let prisma: ReturnType<typeof mockDeep<PrismaService>>;
  let appSetting: ReturnType<typeof mockDeep<AppSettingService>>;
  let payout: ReturnType<typeof mockDeep<ReferralRewardPayoutProvider>>;
  let service: ReferralService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    appSetting = mockDeep<AppSettingService>();
    payout = mockDeep<ReferralRewardPayoutProvider>();
    service = new ReferralService(prisma as any, appSetting as any, payout);
    jest.clearAllMocks();
  });

  // ── Shared mock setup: referrer lookup returns driverX/customerX ──
  const mockDriverReferrer = () => {
    prisma.driver.findFirst.mockResolvedValue({
      id: "driver-ref-1",
      referralCode: "DRVCODE1",
      userId: "user-driver-ref",
    } as any);
    prisma.customer.findFirst.mockResolvedValue(null as any);
  };
  const mockCustomerReferrer = (customerType: "PERSONAL" | "BUSINESS") => {
    prisma.driver.findFirst.mockResolvedValue(null as any);
    prisma.customer.findFirst.mockResolvedValue({
      id: "cust-ref-1",
      referralCode: "CUSTCODE",
      userId: "user-cust-ref",
      customerType,
    } as any);
  };

  describe("applyReferral (a driver applies a code)", () => {
    beforeEach(() => {
      prisma.referral.findFirst.mockResolvedValue(null as any); // no legacy row, no existing link
      prisma.driver.findUnique.mockResolvedValue({
        user: { email: "new.driver@test.com" },
        createdAt: new Date(),
        approvedAt: null,
        status: "PENDING",
      } as any);
      prisma.referral.create.mockResolvedValue({ id: "new-ref" } as any);
    });

    it("ACCEPTS a driver referrer by default (DRIVER→DRIVER true)", async () => {
      mockDriverReferrer();
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      await service.applyReferral("new-driver-1", "DRVCODE1");
      expect(prisma.referral.create).toHaveBeenCalledTimes(1);
    });

    it("ACCEPTS a personal customer referrer by default (PERSONAL→DRIVER true — owner-confirmed)", async () => {
      mockCustomerReferrer("PERSONAL");
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      await service.applyReferral("new-driver-1", "CUSTCODE");
      expect(prisma.referral.create).toHaveBeenCalledTimes(1);
    });

    it("REJECTS a driver referrer when the matrix says DRIVER→DRIVER is off", async () => {
      mockDriverReferrer();
      appSetting.getReferralProgramSettings.mockResolvedValue(
        buildConfig({
          ...DEFAULT_MATRIX,
          DRIVER: { DRIVER: false, PERSONAL: true, BUSINESS: false },
        }) as any,
      );
      await expect(service.applyReferral("new-driver-1", "DRVCODE1")).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.applyReferral("new-driver-1", "DRVCODE1"),
      ).rejects.toThrow("Drivers can't refer drivers");
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });
  });

  describe("applyCustomerReferral (a customer applies a code)", () => {
    const referred = (customerType: "PERSONAL" | "BUSINESS") => {
      prisma.customer.findUnique.mockResolvedValue({
        customerType,
        createdAt: new Date(),
        contactEmail: "referred@test.com",
        user: { email: "referred@test.com" },
      } as any);
    };

    beforeEach(() => {
      prisma.referral.findFirst.mockResolvedValue(null as any); // no legacy row, no existing link
      prisma.referral.create.mockResolvedValue({ id: "new-ref" } as any);
    });

    it("REJECTS a personal customer referrer referring a BUSINESS by default (PERSONAL→BUSINESS false)", async () => {
      mockCustomerReferrer("PERSONAL");
      referred("BUSINESS");
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      await expect(
        service.applyCustomerReferral("business-cust-1", "CUSTCODE"),
      ).rejects.toThrow("Personal customers can't refer business customers");
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it("REJECTS a driver referrer referring a BUSINESS by default (DRIVER→BUSINESS false)", async () => {
      mockDriverReferrer();
      referred("BUSINESS");
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      await expect(
        service.applyCustomerReferral("business-cust-1", "DRVCODE1"),
      ).rejects.toThrow("Drivers can't refer business customers");
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it("ACCEPTS a business referrer referring a BUSINESS (B2B — the $10 program's source)", async () => {
      mockCustomerReferrer("BUSINESS");
      referred("BUSINESS");
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      const result = await service.applyCustomerReferral("business-cust-1", "CUSTCODE");
      expect(result.success).toBe(true);
      expect(prisma.referral.create).toHaveBeenCalledTimes(1);
      expect(prisma.referral.create.mock.calls[0][0].data.category).toBe("BUSINESS_REFERRAL");
    });

    it("ACCEPTS a driver referrer referring a PERSONAL customer (DRIVER→PERSONAL true)", async () => {
      mockDriverReferrer();
      referred("PERSONAL");
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);
      const result = await service.applyCustomerReferral("personal-cust-1", "DRVCODE1");
      expect(result.success).toBe(true);
      expect(prisma.referral.create.mock.calls[0][0].data.category).toBe("RESIDENTIAL_REFERRAL");
    });

    it("REJECTS when the admin flips BUSINESS→PERSONAL off", async () => {
      mockCustomerReferrer("BUSINESS");
      referred("PERSONAL");
      appSetting.getReferralProgramSettings.mockResolvedValue(
        buildConfig({
          ...DEFAULT_MATRIX,
          BUSINESS: { DRIVER: true, PERSONAL: false, BUSINESS: true },
        }) as any,
      );
      await expect(
        service.applyCustomerReferral("personal-cust-1", "CUSTCODE"),
      ).rejects.toThrow("Business customers can't refer personal customers");
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });
  });

  describe("publicResolveReferralCode — `allows` drives the invite-page doors", () => {
    it("driver code → allows = the DRIVER matrix row", async () => {
      prisma.driver.findFirst.mockResolvedValue({
        id: "d1",
        userId: "u1",
        user: { fullName: "Jane Driver" },
      } as any);
      prisma.customer.findFirst.mockResolvedValue(null as any);
      prisma.referral.findFirst.mockResolvedValue(null as any);
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);

      const res = await service.publicResolveReferralCode("DRVCODE1");
      expect(res.found).toBe(true);
      expect(res.allows).toEqual(DEFAULT_MATRIX.DRIVER);
    });

    it("personal customer code → allows = the PERSONAL row (no dealer door)", async () => {
      prisma.driver.findFirst.mockResolvedValue(null as any);
      prisma.customer.findFirst.mockResolvedValue({
        id: "c1",
        userId: "u2",
        contactName: "Rider Rita",
        businessName: null,
        customerType: "PERSONAL",
        user: { fullName: "Rider Rita" },
      } as any);
      prisma.referral.findFirst.mockResolvedValue(null as any);
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);

      const res = await service.publicResolveReferralCode("CUSTCODE");
      expect(res.found).toBe(true);
      expect(res.referrerSubtype).toBe("PERSONAL");
      expect(res.allows).toEqual(DEFAULT_MATRIX.PERSONAL);
      expect(res.allows!.BUSINESS).toBe(false); // no dealer button on her invite page
    });

    it("business customer code → allows = the BUSINESS row (dealer door open)", async () => {
      prisma.driver.findFirst.mockResolvedValue(null as any);
      prisma.customer.findFirst.mockResolvedValue({
        id: "c2",
        userId: "u3",
        contactName: null,
        businessName: "Ace Auto Shop",
        customerType: "BUSINESS",
        user: { fullName: "Ace Owner" },
      } as any);
      prisma.referral.findFirst.mockResolvedValue(null as any);
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);

      const res = await service.publicResolveReferralCode("BIZCODE1");
      expect(res.found).toBe(true);
      expect(res.referrerSubtype).toBe("BUSINESS");
      expect(res.allows).toEqual(DEFAULT_MATRIX.BUSINESS);
      expect(res.allows!.BUSINESS).toBe(true);
    });

    it("unknown code → found=false with allows=null", async () => {
      prisma.driver.findFirst.mockResolvedValue(null as any);
      prisma.customer.findFirst.mockResolvedValue(null as any);
      prisma.referral.findFirst.mockResolvedValue(null as any);
      appSetting.getReferralProgramSettings.mockResolvedValue(buildConfig() as any);

      const res = await service.publicResolveReferralCode("UNKNOWN8");
      expect(res.found).toBe(false);
      expect(res.allows).toBeNull();
    });
  });
});

/**
 * Unit tests for ReferralService — admin endpoints (Phase 3).
 *
 * Covers:
 *   - getAdminProgramStats: returns V2 stats shape with perModel + perReferrerType + credit totals
 *   - getAdminReferralsList: filters by referralType/payoutModel/status/search
 *   - getAdminReferralDetail: returns referral + credits + payouts (with PER_DELIVERY marker parsing)
 *   - manualOverrideReferralStatus: allowed/disallowed transitions
 *   - getAdminReferralCreditsList: filter by status/customer/referral
 *   - manualApplyReferralCredit: PENDING → APPLIED
 *   - manualExpireReferralCredit: PENDING → EXPIRED
 *
 * Prisma + payout-provider are mocked with jest-mock-extended's mockDeep.
 */
import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ReferralService } from "./referral.service";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

describe("ReferralService — admin endpoints (Phase 3)", () => {
  let service: ReferralService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let appSettingMock: DeepMockProxy<AppSettingService>;
  let payoutProviderMock: DeepMockProxy<ReferralRewardPayoutProvider>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    appSettingMock = mockDeep<AppSettingService>();
    payoutProviderMock = mockDeep<ReferralRewardPayoutProvider>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AppSettingService, useValue: appSettingMock },
        { provide: REFERRAL_REWARD_PAYOUT_PROVIDER, useValue: payoutProviderMock },
      ],
    }).compile();

    service = moduleRef.get<ReferralService>(ReferralService);
  });

  afterEach(() => {
    mockReset(prismaMock);
    mockReset(appSettingMock);
    mockReset(payoutProviderMock);
  });

  // ── getAdminProgramStats ─────────────────────────────────────────
  describe("getAdminProgramStats", () => {
    it("returns V2 stats shape with perModel + perReferrerType + credit totals", async () => {
      // Mock all 13 parallel calls in order:
      // 0: totalReferrals (referral.count for real referrals)
      // 1: successfulReferrals (referral.count REWARD_PAID)
      // 2: activeReferrals (referral.count active statuses)
      // 3: expiredReferrals (referral.count EXPIRED)
      // 4: uniqueDriverReferrersAgg (groupBy referrerId)
      // 5: uniqueCustomerReferrersAgg (groupBy referrerUserId)
      // 6: paidPayouts (driverPayout.findMany PAID)
      // 7: pendingPayouts (driverPayout.findMany PENDING/ELIGIBLE)
      // 8: creditsAgg (referralCredit.groupBy status)
      // 9: tieredCount (referral.count TIERED)
      // 10: perDeliveryCount (referral.count PER_DELIVERY)
      // 11: driverTypeCount (referral.count DRIVER)
      // 12: customerTypeCount (referral.count CUSTOMER)
      let countCall = 0;
      // The 8 count calls in order:
      //   0: totalReferrals, 1: successfulReferrals, 2: activeReferrals,
      //   3: expiredReferrals, 4: tieredCount, 5: perDeliveryCount,
      //   6: driverTypeCount, 7: customerTypeCount
      const sequence = [100, 30, 50, 20, 5, 60, 40, 40];
      (prismaMock.referral.count as any).mockImplementation(async () => {
        return sequence[countCall++] ?? 0;
      });
      (prismaMock.referral.groupBy as any).mockImplementation(async (args: any) => {
        // groupBy referrerId → return 3 rows
        // groupBy referrerUserId → return 2 rows
        if ((args as any)?.by?.[0] === "referrerId") {
          return [
            { referrerId: "d1", _count: { _all: 5 } },
            { referrerId: "d2", _count: { _all: 3 } },
            { referrerId: "d3", _count: { _all: 2 } },
          ];
        }
        return [
          { referrerUserId: "u1", _count: { _all: 4 } },
          { referrerUserId: "u2", _count: { _all: 1 } },
        ];
      });
      (prismaMock.driverPayout.findMany as any).mockImplementation(async (args: any) => {
        const status = (args as any)?.where?.status;
        if (status === "PAID") {
          return [{ netAmount: 100 }, { netAmount: 50 }];
        }
        return [{ netAmount: 30 }];
      });
      (prismaMock.referralCredit.groupBy as any).mockResolvedValue([
        { status: "PENDING", _sum: { amountCents: 1500 }, _count: { _all: 3 } },
        { status: "APPLIED", _sum: { amountCents: 5000 }, _count: { _all: 10 } },
      ]);

      const stats = await service.getAdminProgramStats();

      // V2 shape checks
      expect(stats).toHaveProperty("totalReferrals", 100);
      expect(stats).toHaveProperty("successfulReferrals", 30);
      expect(stats).toHaveProperty("activeReferrals", 50);
      expect(stats).toHaveProperty("expiredReferrals", 20);
      expect(stats).toHaveProperty("uniqueReferrers", 3); // 3 distinct driver referrerIds
      expect(stats).toHaveProperty("uniqueCustomerReferrers", 2); // 2 distinct customer referrerUserIds
      expect(stats).toHaveProperty("totalPaidOut", 150); // 100 + 50
      expect(stats).toHaveProperty("totalPending", 30);
      // Credits: PENDING (1500) + APPLIED (5000) = 6500 issued; APPLIED = 5000 applied
      expect(stats).toHaveProperty("totalCreditsIssuedCents", 6500);
      expect(stats).toHaveProperty("totalCreditsAppliedCents", 5000);
      // perModel breakdown
      expect(stats.perModel).toEqual({
        TIERED: { count: 5 },
        PER_DELIVERY: { count: 60 },
      });
      // perReferrerType breakdown
      expect(stats.perReferrerType).toEqual({
        DRIVER: { count: 40 },
        CUSTOMER: { count: 40 }, // sequence[7] = 40 (customerTypeCount)
      });
    });
  });

  // ── getAdminReferralsList ────────────────────────────────────────
  describe("getAdminReferralsList", () => {
    it("filters by referralType=CUSTOMER and returns mapped referrals", async () => {
      const findManySpy = (prismaMock.referral.findMany as any).mockResolvedValue([
        {
          id: "ref-1",
          referralCode: "ABCD2345",
          status: "REGISTERED",
          referralType: "CUSTOMER",
          payoutModel: "PER_DELIVERY",
          referredEmail: "jane@example.com",
          referredDriverId: null,
          referredCustomerId: "cust-1",
          referrerId: null,
          referrerUserId: "user-1",
          tripsCompleted: 0,
          completedPaidDeliveries: 2,
          requiredDeliveries: 30,
          rewardTrigger: "ON_DELIVERIES_COMPLETED",
          referredGetsReward: true,
          referredRewardAmount: 50,
          referredRewardPaidAt: null,
          expiresAt: null,
          createdAt: new Date("2026-01-01"),
          referredDriver: null,
          referredCustomer: {
            id: "cust-1",
            contactName: "Jane Dealer",
            businessName: null,
            customerType: "BUSINESS",
            contactEmail: "jane@example.com",
            user: { id: "u-cust", fullName: "Jane Dealer", email: "jane@example.com" },
          },
          referrer: null,
        },
      ]);
      (prismaMock.referral.count as any).mockResolvedValue(1);
      // Referrer user + customer lookup
      (prismaMock.user.findMany as any).mockResolvedValue([
        { id: "user-1", fullName: "Acme Auto", email: "acme@auto.com" },
      ]);
      (prismaMock.customer.findMany as any).mockResolvedValue([
        { userId: "user-1", businessName: "Acme Auto", contactName: null, customerType: "BUSINESS" },
      ]);

      const result = await service.getAdminReferralsList({
        page: 1,
        pageSize: 20,
        referralType: "CUSTOMER",
      });

      // Verify the Prisma call had the referralType filter
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            referralType: "CUSTOMER",
            OR: expect.any(Array),
          }),
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 20,
        }),
      );
      // Verify the mapped output has referrerType=CUSTOMER + businessName
      expect(result.referrals).toHaveLength(1);
      expect(result.referrals[0]).toMatchObject({
        id: "ref-1",
        referralType: "CUSTOMER",
        payoutModel: "PER_DELIVERY",
        referrer: { type: "CUSTOMER", name: "Acme Auto", customerType: "BUSINESS" },
        referredCustomer: { name: "Jane Dealer", customerType: "BUSINESS" },
        completedPaidDeliveries: 2,
      });
      expect(result.total).toBe(1);
    });

    it("filters by payoutModel=PER_DELIVERY", async () => {
      (prismaMock.referral.findMany as any).mockResolvedValue([]);
      (prismaMock.referral.count as any).mockResolvedValue(0);

      await service.getAdminReferralsList({
        payoutModel: "PER_DELIVERY",
      });

      expect(prismaMock.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            payoutModel: "PER_DELIVERY",
          }),
        }),
      );
    });

    it("filters by status=EXPIRED", async () => {
      (prismaMock.referral.findMany as any).mockResolvedValue([]);
      (prismaMock.referral.count as any).mockResolvedValue(0);

      await service.getAdminReferralsList({
        status: "EXPIRED",
      });

      expect(prismaMock.referral.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "EXPIRED",
          }),
        }),
      );
    });
  });

  // ── getAdminReferralDetail ───────────────────────────────────────
  describe("getAdminReferralDetail", () => {
    it("returns referral + credits + payouts with PER_DELIVERY marker parsing", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        id: "ref-1",
        referralCode: "ABCD2345",
        status: "REGISTERED",
        referralType: "DRIVER",
        payoutModel: "PER_DELIVERY",
        referrerId: "driver-1",
        referrerUserId: null,
        referredDriverId: "driver-2",
        referredCustomerId: null,
        referredEmail: "newdriver@example.com",
        referredPhone: null,
        rewardTrigger: "ON_DELIVERIES_COMPLETED",
        requiredDeliveries: 30,
        tripsCompleted: 0,
        completedPaidDeliveries: 3,
        windowStartDate: null,
        windowEndDate: null,
        expiresAt: null,
        referredGetsReward: true,
        referredRewardAmount: 50,
        referredRewardPaidAt: null,
        referredPayoutId: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        referrer: { id: "driver-1", user: { id: "u-1", fullName: "Driver One", email: "d1@x.com" } },
        referredDriver: { id: "driver-2", user: { id: "u-2", fullName: "Driver Two", email: "d2@x.com" } },
        referredCustomer: null,
      });
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([
        {
          id: "credit-1",
          referralId: "ref-1",
          customerId: "cust-1",
          deliveryId: "del-1",
          amountCents: 500,
          reason: "Per-delivery referrer credit (delivery del-1)",
          status: "PENDING",
          appliedAt: null,
          stripeInvoiceId: null,
          createdAt: new Date("2026-01-03"),
        },
      ]);
      (prismaMock.driverPayout.findMany as any).mockResolvedValue([
        {
          id: "payout-1",
          type: "REFERRAL_REFERRER",
          status: "PENDING",
          netAmount: 5,
          grossAmount: 5,
          failureMessage: "PER_DELIVERY:del-1",
          tierNumber: null,
          createdAt: new Date("2026-01-03"),
          paidAt: null,
        },
        {
          id: "payout-2",
          type: "REFERRAL_REFERRER",
          status: "PAID",
          netAmount: 150,
          grossAmount: 150,
          failureMessage: "TIER:1",
          tierNumber: 1,
          createdAt: new Date("2026-01-04"),
          paidAt: new Date("2026-01-05"),
        },
      ]);

      const result = await service.getAdminReferralDetail("ref-1");

      // Referral shape
      expect(result.referral.id).toBe("ref-1");
      expect(result.referral.referrer?.id).toBe("driver-1");
      expect(result.referral.referredDriver?.id).toBe("driver-2");

      // Credits
      expect(result.credits).toHaveLength(1);
      expect(result.credits[0]).toMatchObject({
        id: "credit-1",
        amountCents: 500,
        status: "PENDING",
      });

      // Payouts with PER_DELIVERY marker parsing
      expect(result.payouts).toHaveLength(2);
      expect(result.payouts[0]).toMatchObject({
        id: "payout-1",
        isPerDelivery: true,
        perDeliveryId: "del-1",
      });
      expect(result.payouts[1]).toMatchObject({
        id: "payout-2",
        isPerDelivery: false,
        perDeliveryId: null,
        tierNumber: 1,
      });
    });

    it("throws NotFoundException when referral doesn't exist", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue(null);

      await expect(service.getAdminReferralDetail("missing-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── manualOverrideReferralStatus ─────────────────────────────────
  describe("manualOverrideReferralStatus", () => {
    it("refuses to transition FROM REWARD_PAID", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        id: "ref-1",
        status: "REWARD_PAID",
        referredDriverId: "driver-2",
        referredGetsReward: true,
        referredRewardAmount: 50,
        referredRewardPaidAt: new Date(),
        referrerId: "driver-1",
      });

      await expect(
        service.manualOverrideReferralStatus("ref-1", "EXPIRED", "test"),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns 'status unchanged' if already in target status", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        id: "ref-1",
        status: "EXPIRED",
        referredDriverId: null,
        referredGetsReward: false,
        referredRewardAmount: null,
        referredRewardPaidAt: null,
        referrerId: "driver-1",
      });

      const result = await service.manualOverrideReferralStatus("ref-1", "EXPIRED");
      expect(result.message).toMatch(/unchanged/);
    });

    it("fires the referred reward payout when transitioning to REWARD_PAID", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        id: "ref-1",
        status: "REGISTERED",
        referredDriverId: "driver-2",
        referredGetsReward: true,
        referredRewardAmount: 50,
        referredRewardPaidAt: null,
        referrerId: "driver-1",
      });
      appSettingMock.getReferralProgramSettings.mockResolvedValue({
        referralThreshold: 20,
        referrerRewardAmount: 150,
        referredRewardAmount: 50,
      } as any);
      (prismaMock.referral.update as any).mockResolvedValue({
        id: "ref-1",
        status: "REWARD_PAID",
        referredRewardPaidAt: new Date(),
      });

      const result = await service.manualOverrideReferralStatus("ref-1", "REWARD_PAID");

      // Payout provider was called to fire the one-shot referred reward
      expect(payoutProviderMock.createReferredRewardPayout).toHaveBeenCalledWith({
        referredDriverId: "driver-2",
        amount: 50,
        referralId: "ref-1",
      });
      // Referral status updated to REWARD_PAID + referredRewardPaidAt set
      expect(prismaMock.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref-1" },
          data: expect.objectContaining({
            status: "REWARD_PAID",
            referredRewardPaidAt: expect.any(Date),
          }),
        }),
      );
      expect(result.referral.status).toBe("REWARD_PAID");
    });

    it("marks EXPIRED without firing any payout", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        id: "ref-1",
        status: "REGISTERED",
        referredDriverId: "driver-2",
        referredGetsReward: true,
        referredRewardAmount: 50,
        referredRewardPaidAt: null,
        referrerId: "driver-1",
      });
      (prismaMock.referral.update as any).mockResolvedValue({
        id: "ref-1",
        status: "EXPIRED",
        referredRewardPaidAt: null,
      });

      await service.manualOverrideReferralStatus("ref-1", "EXPIRED", "test window");

      // Payout provider NOT called (transition is to EXPIRED, not REWARD_PAID)
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
      // Referral status updated to EXPIRED only (no referredRewardPaidAt)
      expect(prismaMock.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ref-1" },
          data: { status: "EXPIRED" },
        }),
      );
    });

    it("throws NotFoundException when referral doesn't exist", async () => {
      (prismaMock.referral.findUnique as any).mockResolvedValue(null);

      await expect(
        service.manualOverrideReferralStatus("missing", "EXPIRED"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAdminReferralCreditsList ──────────────────────────────────
  describe("getAdminReferralCreditsList", () => {
    it("filters by status=PENDING and paginates", async () => {
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([
        {
          id: "credit-1",
          referralId: "ref-1",
          customerId: "cust-1",
          deliveryId: "del-1",
          amountCents: 500,
          reason: "Per-delivery referrer credit (delivery del-1)",
          status: "PENDING",
          appliedAt: null,
          stripeInvoiceId: null,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ]);
      (prismaMock.referralCredit.count as any).mockResolvedValue(1);

      const result = await service.getAdminReferralCreditsList({
        page: 1,
        pageSize: 20,
        status: "PENDING",
      });

      expect(prismaMock.referralCredit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.credits).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("filters by customerId", async () => {
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([]);
      (prismaMock.referralCredit.count as any).mockResolvedValue(0);

      await service.getAdminReferralCreditsList({ customerId: "cust-1" });

      expect(prismaMock.referralCredit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: "cust-1" },
        }),
      );
    });
  });

  // ── manualApplyReferralCredit ────────────────────────────────────
  describe("manualApplyReferralCredit", () => {
    it("transitions PENDING → APPLIED with appliedAt + stripeInvoiceId", async () => {
      (prismaMock.referralCredit.findUnique as any).mockResolvedValue({
        id: "credit-1",
        status: "PENDING",
      });
      (prismaMock.referralCredit.update as any).mockResolvedValue({
        id: "credit-1",
        status: "APPLIED",
        appliedAt: new Date(),
        stripeInvoiceId: "in_test_123",
      });

      const result = await service.manualApplyReferralCredit("credit-1", "in_test_123");

      expect(prismaMock.referralCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "credit-1" },
          data: expect.objectContaining({
            status: "APPLIED",
            stripeInvoiceId: "in_test_123",
            appliedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.credit.status).toBe("APPLIED");
    });

    it("refuses to apply a credit in status=APPLIED", async () => {
      (prismaMock.referralCredit.findUnique as any).mockResolvedValue({
        id: "credit-1",
        status: "APPLIED",
      });

      await expect(
        service.manualApplyReferralCredit("credit-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when credit doesn't exist", async () => {
      (prismaMock.referralCredit.findUnique as any).mockResolvedValue(null);

      await expect(
        service.manualApplyReferralCredit("missing"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── manualExpireReferralCredit ───────────────────────────────────
  describe("manualExpireReferralCredit", () => {
    it("transitions PENDING → EXPIRED and appends admin reason", async () => {
      (prismaMock.referralCredit.findUnique as any).mockResolvedValue({
        id: "credit-1",
        status: "PENDING",
        reason: "Per-delivery referrer credit (delivery del-1)",
      });
      (prismaMock.referralCredit.update as any).mockResolvedValue({
        id: "credit-1",
        status: "EXPIRED",
        reason: "Per-delivery referrer credit (delivery del-1) [admin-expired: wrong delivery]",
      });

      const result = await service.manualExpireReferralCredit("credit-1", "wrong delivery");

      expect(prismaMock.referralCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "credit-1" },
          data: expect.objectContaining({
            status: "EXPIRED",
            reason: expect.stringContaining("admin-expired: wrong delivery"),
          }),
        }),
      );
      expect(result.credit.status).toBe("EXPIRED");
    });

    it("refuses to expire a credit in status=APPLIED", async () => {
      (prismaMock.referralCredit.findUnique as any).mockResolvedValue({
        id: "credit-1",
        status: "APPLIED",
      });

      await expect(
        service.manualExpireReferralCredit("credit-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

/**
 * Unit tests for ReferralService — referral cash payout admin endpoints
 * (born-ELIGIBLE payout monitoring + fraud cancellation).
 *
 * Covers:
 *   - getAdminReferralPayouts: paginated list of REFERRAL_* DriverPayouts
 *     with driver info + PER_DELIVERY attribution parsing + status/type filters
 *   - cancelReferralPayout: PENDING/ELIGIBLE → CANCELLED with audit reason
 *   - cancelReferralPayout guards: not found, wrong type, PAID/FAILED/CANCELLED
 *
 * Prisma is mocked with jest-mock-extended's mockDeep.
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

describe("ReferralService — referral cash payouts (list + cancel)", () => {
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

  // ── getAdminReferralPayouts ──────────────────────────────────────
  describe("getAdminReferralPayouts", () => {
    it("lists REFERRAL_* payouts only, with driver info and parsed attribution", async () => {
      (prismaMock.driverPayout.findMany as any).mockResolvedValue([
        {
          id: "payout-1",
          driverId: "driver-1",
          type: "REFERRAL_REFERRER",
          status: "ELIGIBLE",
          grossAmount: 5,
          netAmount: 5,
          tierNumber: null,
          failureMessage: "PER_DELIVERY:referral-1:delivery-1",
          createdAt: new Date("2026-01-01"),
          paidAt: null,
          providerTransferId: null,
          driver: { user: { fullName: "Alice Referrer", email: "alice@x.io" } },
        },
        {
          id: "payout-2",
          driverId: "driver-2",
          type: "REFERRAL_REFERRED",
          status: "PAID",
          grossAmount: 50,
          netAmount: 50,
          tierNumber: null,
          failureMessage: null,
          createdAt: new Date("2026-01-02"),
          paidAt: new Date("2026-01-03"),
          providerTransferId: "tr_123",
          driver: { user: { fullName: "Bob Referred", email: "bob@x.io" } },
        },
      ]);
      (prismaMock.driverPayout.count as any).mockResolvedValue(2);

      const result = await service.getAdminReferralPayouts({
        page: 1,
        pageSize: 20,
      });

      // The where clause scopes to the two referral types
      const whereArg = (prismaMock.driverPayout.findMany as any).mock.calls[0][0].where;
      expect(whereArg.type).toEqual({
        in: ["REFERRAL_REFERRER", "REFERRAL_REFERRED"],
      });

      expect(result.total).toBe(2);
      expect(result.payouts).toHaveLength(2);

      // Row 1: PER_DELIVERY key parsed into referralId + deliveryId
      expect(result.payouts[0]).toMatchObject({
        id: "payout-1",
        driverName: "Alice Referrer",
        driverEmail: "alice@x.io",
        status: "ELIGIBLE",
        referralId: "referral-1",
        deliveryId: "delivery-1",
      });
      // Row 2: no failureMessage → attribution stays null
      expect(result.payouts[1].referralId).toBeNull();
      expect(result.payouts[1].deliveryId).toBeNull();
    });

    it("status + type filters narrow the where clause", async () => {
      (prismaMock.driverPayout.findMany as any).mockResolvedValue([]);
      (prismaMock.driverPayout.count as any).mockResolvedValue(0);

      await service.getAdminReferralPayouts({
        page: 2,
        pageSize: 10,
        status: "ELIGIBLE",
        type: "REFERRER",
      });

      const findArg = (prismaMock.driverPayout.findMany as any).mock.calls[0][0];
      // type=REFERRER overwrites the IN-list with the exact type
      expect(findArg.where).toEqual({
        type: "REFERRAL_REFERRER",
        status: "ELIGIBLE",
      });
      expect(findArg.skip).toBe(10);
      expect(findArg.take).toBe(10);
    });
  });

  // ── cancelReferralPayout ─────────────────────────────────────────
  describe("cancelReferralPayout", () => {
    it("cancels an ELIGIBLE payout and appends the audit reason", async () => {
      (prismaMock.driverPayout.findUnique as any).mockResolvedValue({
        id: "payout-1",
        type: "REFERRAL_REFERRER",
        status: "ELIGIBLE",
        failureMessage: "PER_DELIVERY:referral-1:delivery-1",
      });
      (prismaMock.driverPayout.update as any).mockResolvedValue({
        id: "payout-1",
        status: "CANCELLED",
        failureMessage: "PER_DELIVERY:referral-1:delivery-1 [admin-cancelled: fraud]",
      });

      const result = await service.cancelReferralPayout("payout-1", "fraud");

      expect(prismaMock.driverPayout.update).toHaveBeenCalledWith({
        where: { id: "payout-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          failureMessage: expect.stringContaining("[admin-cancelled: fraud]"),
        }),
        select: { id: true, status: true, failureMessage: true },
      });
      expect(result.payout.status).toBe("CANCELLED");
    });

    it("throws NotFound for an unknown payout id", async () => {
      (prismaMock.driverPayout.findUnique as any).mockResolvedValue(null);
      await expect(service.cancelReferralPayout("nope")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuses to cancel a non-referral payout (TRIP_COMPLETION)", async () => {
      (prismaMock.driverPayout.findUnique as any).mockResolvedValue({
        id: "payout-2",
        type: "TRIP_COMPLETION",
        status: "ELIGIBLE",
        failureMessage: null,
      });
      await expect(service.cancelReferralPayout("payout-2")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.driverPayout.update).not.toHaveBeenCalled();
    });

    it("refuses to cancel a PAID payout (needs clawback, not a status flip)", async () => {
      (prismaMock.driverPayout.findUnique as any).mockResolvedValue({
        id: "payout-3",
        type: "REFERRAL_REFERRER",
        status: "PAID",
        failureMessage: null,
      });
      await expect(service.cancelReferralPayout("payout-3")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.driverPayout.update).not.toHaveBeenCalled();
    });

    it("refuses to cancel an already-CANCELLED payout", async () => {
      (prismaMock.driverPayout.findUnique as any).mockResolvedValue({
        id: "payout-4",
        type: "REFERRAL_REFERRED",
        status: "CANCELLED",
        failureMessage: null,
      });
      await expect(service.cancelReferralPayout("payout-4")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

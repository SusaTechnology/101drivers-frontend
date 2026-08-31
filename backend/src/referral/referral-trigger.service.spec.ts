/**
 * Unit tests for ReferralTriggerService — PER_DELIVERY model behavior.
 *
 * Covers the core Phase 2 logic:
 *   - Role matrix: Driver→Driver, Customer→Customer, Customer→Driver, Driver→Customer
 *   - Per-delivery payout creation (DriverPayout for driver referrer,
 *     ReferralCredit for customer referrer)
 *   - 5th-delivery bonus trigger (fires exactly once on the
 *     perDeliveryBonusTriggerCount-th paid delivery)
 *   - Idempotency: re-calling onDeliveryCompleted for the same delivery
 *     doesn't create duplicate payouts/credits
 *   - PER_DELIVERY skips TIERED-only logic (tripsCompleted not incremented)
 *   - TIERED referrals still work (legacy path)
 *
 * Heavy Prisma + payout-provider dependencies are mocked with
 * jest-mock-extended's mockDeep — we verify the right calls are made
 * without hitting a real DB.
 */
import { Test } from "@nestjs/testing";
import { ReferralTriggerService } from "./referral-trigger.service";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";
import {
  ReferralPayoutModelDto,
  ReferralTypeDto,
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
} from "../appSetting/dto/appSetting.dto";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

// ── Helpers ──────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  isActive: true,
  rewardTrigger: ReferralRewardTrigger.ON_DELIVERIES_COMPLETED,
  requiredDeliveries: 30,
  timeLimitMode: ReferralTimeLimitMode.FOREVER,
  windowStartDate: null,
  windowEndDate: null,
  referrerRewardAmount: 150,
  referralThreshold: 20,
  referredGetsReward: true,
  referredRewardAmount: 150,
  payoutModel: ReferralPayoutModelDto.TIERED,
  perDeliveryReferrerAmountCents: 500, // $5
  perDeliveryReferredBonusCents: 5000, // $50
  perDeliveryBonusTriggerCount: 5, // 5th delivery
  customerReferralsEnabled: true,
  driverReferralsEnabled: true,
};

const buildReferral = (overrides: Partial<any> = {}) => ({
  id: "referral-1",
  referrerId: "driver-referrer-1",
  referrerUserId: null,
  referralType: ReferralTypeDto.DRIVER,
  payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
  status: "REGISTERED",
  rewardTrigger: ReferralRewardTrigger.ON_DELIVERIES_COMPLETED,
  requiredDeliveries: 30,
  tripsCompleted: 0,
  completedPaidDeliveries: 0,
  expiresAt: null,
  referredGetsReward: true,
  referredRewardAmount: 150,
  referredRewardPaidAt: null,
  referredDriverId: "referred-driver-1",
  referredCustomerId: null,
  ...overrides,
});

// Helper: type-loose cast so we can use mockImplementationOnce with
// branching logic without TS complaining about Prisma's strict return types.
const findFirstMock = (mock: any) => mock.referral.findFirst as any;

describe("ReferralTriggerService — PER_DELIVERY model", () => {
  let service: ReferralTriggerService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let appSettingMock: DeepMockProxy<AppSettingService>;
  let payoutProviderMock: DeepMockProxy<ReferralRewardPayoutProvider>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    appSettingMock = mockDeep<AppSettingService>();
    payoutProviderMock = mockDeep<ReferralRewardPayoutProvider>();

    // Default: program is active with PER_DELIVERY defaults
    appSettingMock.getReferralProgramSettings.mockResolvedValue(DEFAULT_CONFIG as any);

    // Default: no existing referral for the driver/customer
    (prismaMock.referral.findFirst as any).mockResolvedValue(null);
    // Default: no existing per-delivery payout (idempotency check passes)
    (prismaMock.driverPayout.findFirst as any).mockResolvedValue(null);
    // Default: no existing referral credit (idempotency check passes)
    (prismaMock.referralCredit.findFirst as any).mockResolvedValue(null);
    // Default: increment + return the new value
    (prismaMock.referral.update as any).mockImplementation(async (args: any) => {
      if (args?.data?.completedPaidDeliveries?.increment !== undefined) {
        // Increment behavior — return the new value (caller can override)
        return { completedPaidDeliveries: 1 };
      }
      return {};
    });
    (prismaMock.referral.updateMany as any).mockResolvedValue({ count: 1 });
    (prismaMock.referral.findUnique as any).mockResolvedValue({
      tripsCompleted: 1,
      requiredDeliveries: 30,
      completedPaidDeliveries: 1,
    });
    (prismaMock.referral.create as any).mockResolvedValue({});
    (prismaMock.driverPayout.create as any).mockResolvedValue({ id: "payout-1" });
    (prismaMock.referralCredit.create as any).mockResolvedValue({ id: "credit-1" });
    (prismaMock.deliveryRequest.findUnique as any).mockResolvedValue({
      customerId: "customer-1",
    });
    (prismaMock.customer.findUnique as any).mockResolvedValue({
      id: "customer-referrer-1",
    });
    (prismaMock.driver.findUnique as any).mockResolvedValue({
      user: { fullName: "Driver Referrer" },
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferralTriggerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AppSettingService, useValue: appSettingMock },
        { provide: REFERRAL_REWARD_PAYOUT_PROVIDER, useValue: payoutProviderMock },
      ],
    }).compile();

    service = moduleRef.get<ReferralTriggerService>(ReferralTriggerService);
    // Silence the logger
    jest.spyOn(service["logger"], "log").mockImplementation(() => undefined);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    mockReset(prismaMock);
    mockReset(appSettingMock);
    mockReset(payoutProviderMock);
  });

  // ── Role matrix: who can refer whom ──────────────────────────────
  describe("role matrix", () => {
    it("Driver→Driver PER_DELIVERY: creates DriverPayout to the driver referrer on each paid delivery", async () => {
      // First call: driver-referral lookup returns the referral
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      // Verify a DriverPayout was created for the driver referrer
      expect(prismaMock.driverPayout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: "driver-referrer-1",
          type: "REFERRAL_REFERRER",
          failureMessage: "PER_DELIVERY:delivery-1",
          grossAmount: 5, // $5 from perDeliveryReferrerAmountCents=500
          netAmount: 5,
        }),
      });
      // Verify no ReferralCredit was created (driver referrer path)
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });

    it("Customer→Driver PER_DELIVERY: creates ReferralCredit to the customer referrer on each paid delivery", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      // Verify the customer referrer was looked up by userId
      expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-customer-referrer-1" },
        select: { id: true },
      });
      // Verify a ReferralCredit was created
      expect(prismaMock.referralCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referralId: "referral-1",
          customerId: "customer-referrer-1",
          deliveryId: "delivery-1",
          amountCents: 500,
        }),
      });
      // Verify no DriverPayout was created (customer referrer path)
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
    });

    it("Customer→Customer PER_DELIVERY: creates ReferralCredit to the customer referrer on each paid delivery", async () => {
      // First call (driver-referral lookup) returns null
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      // Second call (customer-referral lookup by referredCustomerId)
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-referred-1",
      });

      expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-customer-referrer-1" },
        select: { id: true },
      });
      expect(prismaMock.referralCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referralId: "referral-1",
          customerId: "customer-referrer-1",
          deliveryId: "delivery-1",
          amountCents: 500,
        }),
      });
    });

    it("Driver→Customer PER_DELIVERY: creates DriverPayout to the driver referrer when the referred customer completes a delivery", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-referred-1",
      });

      expect(prismaMock.driverPayout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: "driver-referrer-1",
          type: "REFERRAL_REFERRER",
          failureMessage: "PER_DELIVERY:delivery-1",
          grossAmount: 5,
        }),
      });
      // Verify no ReferralCredit was created FOR the driver referrer
      const driverReferrerCreditCall = (
        prismaMock.referralCredit.create as any
      ).mock.calls.find(
        (call: any) => call[0]?.data?.customerId === "driver-referrer-1",
      );
      expect(driverReferrerCreditCall).toBeUndefined();
    });
  });

  // ── 5th-delivery bonus trigger ───────────────────────────────────
  describe("5th-delivery bonus", () => {
    it("Driver referred: fires $50 bonus on the 5th paid delivery via createReferredRewardPayout", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            completedPaidDeliveries: 4, // 5th delivery is the trigger
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
            referredRewardPaidAt: null,
          });
        }
        return null;
      });

      // Simulate the increment from 4 → 5
      (prismaMock.referral.update as any).mockImplementation(async (args: any) => {
        if (args?.data?.completedPaidDeliveries?.increment) {
          return { completedPaidDeliveries: 5 };
        }
        return {};
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-5",
        customerId: "customer-1",
      });

      expect(payoutProviderMock.createReferredRewardPayout).toHaveBeenCalledWith({
        referredDriverId: "referred-driver-1",
        amount: 50, // $50 from perDeliveryReferredBonusCents=5000
        referralId: "referral-1",
      });
      // Verify the referral is marked as REWARD_PAID
      const statusUpdateCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "REWARD_PAID",
      );
      expect(statusUpdateCall).toBeDefined();
    });

    it("Customer referred: fires $50 bonus on the 5th paid delivery via ReferralCredit to the referred customer", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            completedPaidDeliveries: 4,
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
            referredRewardPaidAt: null,
          });
        }
        return null;
      });
      (prismaMock.referral.update as any).mockImplementation(async (args: any) => {
        if (args?.data?.completedPaidDeliveries?.increment) {
          return { completedPaidDeliveries: 5 };
        }
        return {};
      });

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-5",
        customerId: "customer-referred-1",
      });

      // The bonus is a ReferralCredit to the referred customer
      const bonusCall = (prismaMock.referralCredit.create as any).mock.calls.find(
        (call: any) =>
          call[0]?.data?.amountCents === 5000 &&
          call[0]?.data?.customerId === "customer-referred-1",
      );
      expect(bonusCall).toBeDefined();
      // The per-delivery referrer credit was also created
      const referrerCall = (prismaMock.referralCredit.create as any).mock.calls.find(
        (call: any) => call[0]?.data?.amountCents === 500,
      );
      expect(referrerCall).toBeDefined();

      // No DriverPayout (referred side is a customer, not a driver)
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();

      // Referral marked REWARD_PAID + referredRewardPaidAt set
      const statusUpdateCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "REWARD_PAID",
      );
      expect(statusUpdateCall).toBeDefined();
      expect(statusUpdateCall?.[0]?.data?.referredRewardPaidAt).toBeInstanceOf(Date);
    });

    it("does NOT fire bonus on the 4th delivery (only on the trigger count)", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            completedPaidDeliveries: 3, // 4th delivery pushes it to 4
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
            referredRewardPaidAt: null,
          });
        }
        return null;
      });
      (prismaMock.referral.update as any).mockImplementation(async () => ({
        completedPaidDeliveries: 4,
      }));

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-4",
        customerId: "customer-1",
      });

      // Bonus NOT fired
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
      const statusUpdateCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "REWARD_PAID",
      );
      expect(statusUpdateCall).toBeUndefined();
    });

    it("does NOT fire bonus again after the trigger count (idempotency via status check)", async () => {
      // 6th delivery — referral already in REWARD_PAID status
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            completedPaidDeliveries: 5,
            status: "REWARD_PAID", // already paid
            referredRewardPaidAt: new Date(),
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-6",
        customerId: "customer-1",
      });

      // Early return at the idempotency check — no payouts created
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });
  });

  // ── Idempotency: per-delivery payout not duplicated ──────────────
  describe("per-delivery idempotency", () => {
    it("does NOT create duplicate DriverPayout if a payout for the same delivery already exists", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });
      // Simulate existing payout for this delivery
      (prismaMock.driverPayout.findFirst as any).mockResolvedValue({
        id: "existing-payout",
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      // driverPayout.create should NOT be called (idempotency check kicked in)
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      // BUT the referral.update for incrementing completedPaidDeliveries still happens
      const incrementCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.completedPaidDeliveries?.increment === 1,
      );
      expect(incrementCall).toBeDefined();
    });

    it("does NOT create duplicate ReferralCredit if a credit for the same (referral, delivery, customer) already exists", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
          });
        }
        return null;
      });
      // Simulate existing credit
      (prismaMock.referralCredit.findFirst as any).mockResolvedValue({
        id: "existing-credit",
      });

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-referred-1",
      });

      // referralCredit.create should NOT be called for the referrer credit
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });
  });

  // ── TIERED legacy path still works ───────────────────────────────
  describe("TIERED legacy path", () => {
    it("TIERED driver referral: increments tripsCompleted (not completedPaidDeliveries)", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            payoutModel: ReferralPayoutModelDto.TIERED,
            rewardTrigger: ReferralRewardTrigger.ON_DELIVERIES_COMPLETED,
            requiredDeliveries: 2,
            tripsCompleted: 1, // 2nd delivery pushes it to 2 (the threshold)
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });
      (prismaMock.referral.updateMany as any).mockResolvedValue({ count: 1 });
      // Re-fetch after increment returns tripsCompleted = 2
      (prismaMock.referral.findUnique as any).mockResolvedValue({
        tripsCompleted: 2,
        requiredDeliveries: 2,
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-2",
        customerId: "customer-1",
      });

      // Verify tripsCompleted was incremented via updateMany
      const incrementCall = (prismaMock.referral.updateMany as any).mock.calls.find(
        (call: any) => call[0]?.data?.tripsCompleted?.increment === 1,
      );
      expect(incrementCall).toBeDefined();

      // NO per-delivery DriverPayout / ReferralCredit creation
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();

      // NO completedPaidDeliveries increment
      const cpdCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.completedPaidDeliveries?.increment === 1,
      );
      expect(cpdCall).toBeUndefined();
    });
  });

  // ── Backward compat: bare driverId string still works ───────────
  describe("backward compat with bare driverId", () => {
    it("accepts a bare driverId string (legacy callers) — no PER_DELIVERY payout without deliveryId", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted("referred-driver-1" as any);

      // PER_DELIVERY handler returns early because deliveryId is empty.
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
      // No increment either (early return)
      expect(prismaMock.referral.update).not.toHaveBeenCalled();
    });
  });

  // ── Paused program ──────────────────────────────────────────────
  describe("program state", () => {
    it("skips per-delivery payout when program isActive=false", async () => {
      appSettingMock.getReferralProgramSettings.mockResolvedValue({
        ...DEFAULT_CONFIG,
        isActive: false,
      } as any);

      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });

    it("marks referral EXPIRED when expiresAt has passed", async () => {
      const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            expiresAt: pastDate,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            referredDriverId: "referred-driver-1",
          });
        }
        return null;
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-1",
      });

      const expiredCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "EXPIRED",
      );
      expect(expiredCall).toBeDefined();

      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });
  });

  // ── No referral for the driver ──────────────────────────────────
  describe("no referral for the driver", () => {
    it("does nothing when the driver has no referral", async () => {
      // Both lookups return null
      (prismaMock.referral.findFirst as any).mockResolvedValue(null);

      await service.onDeliveryCompleted({
        driverId: "unreferred-driver-1",
        deliveryId: "delivery-1",
        customerId: "unreferred-customer-1",
      });

      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
    });
  });
});

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
  perDeliveryReferrerAmountCents: 500, // $5 (old uniform — kept for backward compat)
  perDeliveryPersonalReferrerAmountCents: 500,    // $5
  perDeliveryBusinessReferrerAmountCents: 1000,   // $10
  perDeliveryDriverReferrerAmountCents: 500,      // $5
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
    it("Driver→Driver PER_DELIVERY: does NOT create per-delivery payout (only $50 bonus on 5th — spec)", async () => {
      // SPEC: "Per-delivery payouts are ONLY for referred CUSTOMERS, not referred drivers."
      // A referred driver does NOT generate a per-delivery payout for the referrer.
      // The only payout for referring a driver is the $50 bonus on the 5th delivery.
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

      // SPEC: NO per-delivery DriverPayout should be created for a referred driver
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      // SPEC: NO ReferralCredit should be created either
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
      // The completedPaidDeliveries counter IS still incremented (for the $50 bonus trigger)
      const incrementCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.completedPaidDeliveries?.increment === 1,
      );
      expect(incrementCall).toBeDefined();
    });

    it("Customer→Driver PER_DELIVERY: does NOT create per-delivery payout (only $50 bonus on 5th — spec)", async () => {
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

      // SPEC: NO per-delivery payout for referred drivers — neither DriverPayout nor ReferralCredit
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
    });

    it("Customer→Customer PER_DELIVERY (V3): one-time ReferralCredit to the customer referrer on the referred customer's FIRST paid delivery", async () => {
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
            category: "RESIDENTIAL_REFERRAL",
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

      // V3: the "first delivery" slot is claimed atomically via updateMany
      expect(prismaMock.referral.updateMany).toHaveBeenCalledWith({
        where: { id: "referral-1", completedPaidDeliveries: 0 },
        data: { completedPaidDeliveries: 1 },
      });
      // Referrer lookup (payout vehicle resolution) — id only, V3 no longer
      // keys the amount off the referrer's customerType
      expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-customer-referrer-1" },
        select: { id: true },
      });
      // One-time RESIDENTIAL_REFERRAL reward: $5 = 500 cents (V3 amount is
      // keyed to the REFERRED customer's type via the category snapshot)
      expect(prismaMock.referralCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referralId: "referral-1",
          customerId: "customer-referrer-1",
          deliveryId: "delivery-1",
          amountCents: 500,
        }),
      });
      // One-time semantics: referral goes terminal after the first payout
      expect(prismaMock.referral.update).toHaveBeenCalledWith({
        where: { id: "referral-1" },
        data: expect.objectContaining({ status: "REWARD_PAID" }),
      });
    });

    it("Driver→Customer PER_DELIVERY (V3): one-time DriverPayout to the driver referrer on the referred customer's first delivery", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: "driver-referrer-1",
            referralType: ReferralTypeDto.DRIVER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            category: "RESIDENTIAL_REFERRAL",
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
          // V3 key format includes the referralId (for cap attribution)
          failureMessage: "PER_DELIVERY:referral-1:delivery-1",
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
    it("Driver referred by DRIVER: $50 bonus goes to REFERRER via DriverPayout (not the referred driver)", async () => {
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

      // SPEC: $50 goes to the REFERRER (driver-referrer-1), NOT the referred driver
      // Old code used createReferredRewardPayout (paid the referred driver) — that's WRONG.
      // New code creates a DriverPayout for the referrer with the $50 bonus amount.
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
      expect(prismaMock.driverPayout.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driverId: "driver-referrer-1", // REFERRER gets the payout
          type: "REFERRAL_REFERRER",
          grossAmount: 50, // $50 bonus
          netAmount: 50,
        }),
      });
      // Verify the referral is marked as REWARD_PAID + referredRewardPaidAt set
      const statusUpdateCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "REWARD_PAID",
      );
      expect(statusUpdateCall).toBeDefined();
      expect(statusUpdateCall?.[0]?.data?.referredRewardPaidAt).toBeInstanceOf(Date);
    });

    it("Driver referred by CUSTOMER (business): $50 bonus goes to REFERRER via ReferralCredit", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredDriverId) {
          return buildReferral({
            completedPaidDeliveries: 4,
            referrerId: null,
            referrerUserId: "user-business-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            referredDriverId: "referred-driver-1",
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
      (prismaMock.customer.findUnique as any).mockResolvedValue({
        id: "business-customer-referrer-1",
        customerType: "BUSINESS",
      });

      await service.onDeliveryCompleted({
        driverId: "referred-driver-1",
        deliveryId: "delivery-5",
        customerId: "customer-1",
      });

      // SPEC: $50 goes to the REFERRER (business customer) as a ReferralCredit
      expect(payoutProviderMock.createReferredRewardPayout).not.toHaveBeenCalled();
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      const bonusCall = (prismaMock.referralCredit.create as any).mock.calls.find(
        (call: any) => call[0]?.data?.amountCents === 5000,
      );
      expect(bonusCall).toBeDefined();
      expect(bonusCall[0]?.data?.customerId).toBe("business-customer-referrer-1");
      expect(bonusCall[0]?.data?.reason).toContain("$50 bonus");
    });

    it("Customer referred (V3): no payout after the first delivery — referral goes terminal without any bonus", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            completedPaidDeliveries: 4,
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            category: "RESIDENTIAL_REFERRAL",
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
            referredRewardPaidAt: null,
          });
        }
        return null;
      });
      // V3: this is NOT the first delivery (completedPaidDeliveries=4), so
      // the atomic claim (where completedPaidDeliveries: 0) must FAIL.
      (prismaMock.referral.updateMany as any).mockResolvedValue({ count: 0 });

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-5",
        customerId: "customer-referred-1",
      });

      // SPEC: "The $50 bonus is ONLY for referred DRIVERS, not referred customers."
      // NO $50 bonus credit should be created
      const bonusCall = (prismaMock.referralCredit.create as any).mock.calls.find(
        (call: any) =>
          call[0]?.data?.amountCents === 5000 &&
          call[0]?.data?.customerId === "customer-referred-1",
      );
      expect(bonusCall).toBeUndefined();

      // NO referrer credit either — the one-time reward already happened on
      // the FIRST delivery (one-time semantics, not per-delivery)
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();

      // Referral IS marked REWARD_PAID (terminal — no re-processing)
      const statusUpdateCall = (prismaMock.referral.update as any).mock.calls.find(
        (call: any) => call[0]?.data?.status === "REWARD_PAID",
      );
      expect(statusUpdateCall).toBeDefined();
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
  // ── V3: one-time customer rewards + rolling cap ────────────────
  describe("V3 one-time customer rewards + rolling cap", () => {
    it("BUSINESS_REFERRAL: pays $10 (1000c) one-time to the referrer on the referred business customer's first delivery", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            category: "BUSINESS_REFERRAL",
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
          });
        }
        return null;
      });
      // No prior cap usage
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([]);

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-referred-1",
      });

      expect(prismaMock.referralCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referralId: "referral-1",
          customerId: "customer-referrer-1",
          deliveryId: "delivery-1",
          amountCents: 1000,
        }),
      });
    });

    it("BUSINESS_REFERRAL rolling cap: payout FORFEITED (no credit) when used + amount > cap, referral still goes terminal", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            category: "BUSINESS_REFERRAL",
            referredCustomerId: "customer-referred-1",
            referredDriverId: null,
          });
        }
        return null;
      });
      // Trailing-30-day cap usage: $295 already earned (29500c); the new
      // $10 (1000c) would take it to 30500c > 30000c cap → forfeit.
      (prismaMock.referralCredit.findMany as any).mockResolvedValue([
        { amountCents: 29500 },
      ]);

      await service.onDeliveryCompleted({
        driverId: "driver-1",
        deliveryId: "delivery-1",
        customerId: "customer-referred-1",
      });

      // No payout created
      expect(prismaMock.referralCredit.create).not.toHaveBeenCalled();
      expect(prismaMock.driverPayout.create).not.toHaveBeenCalled();
      // …but the referral still goes terminal (forfeit, not defer)
      expect(prismaMock.referral.update).toHaveBeenCalledWith({
        where: { id: "referral-1" },
        data: expect.objectContaining({ status: "REWARD_PAID" }),
      });
    });

    it("RESIDENTIAL_REFERRAL: never cap-checked (no cap per spec)", async () => {
      findFirstMock(prismaMock).mockImplementationOnce(async () => null);
      findFirstMock(prismaMock).mockImplementationOnce(async (args: any) => {
        if (args?.where?.referredCustomerId) {
          return buildReferral({
            referrerId: null,
            referrerUserId: "user-customer-referrer-1",
            referralType: ReferralTypeDto.CUSTOMER,
            payoutModel: ReferralPayoutModelDto.PER_DELIVERY,
            category: "RESIDENTIAL_REFERRAL",
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

      // Cap-usage query is a referralCredit.findMany with a BUSINESS_REFERRAL
      // join — residential must not run it at all
      const capQueryCall = (prismaMock.referralCredit.findMany as any).mock.calls.find(
        (call: any) =>
          call[0]?.where?.referral?.category === "BUSINESS_REFERRAL",
      );
      expect(capQueryCall).toBeUndefined();
      // Reward still paid
      expect(prismaMock.referralCredit.create).toHaveBeenCalled();
    });
  });

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

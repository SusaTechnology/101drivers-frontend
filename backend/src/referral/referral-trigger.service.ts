/**
 * ReferralTriggerService — fires referral reward payouts.
 *
 * Two entry points (called by external modules — driver approval
 * flow + delivery completion flow):
 *
 *   onDriverApproved(driverId)
 *     Called when admin moves a driver from PENDING_APPROVAL → APPROVED.
 *     Fires the trigger ONLY IF the referral's snapshotted policy is
 *     rewardTrigger = ON_APPROVED.
 *
 *   onDeliveryCompleted(input)
 *     Called when a driver completes a delivery. Branches on the
 *     referral's payoutModel:
 *       - TIERED: increments `tripsCompleted`, fires the one-shot
 *         referred-driver reward + the referrer tier payouts when
 *         `tripsCompleted >= requiredDeliveries`.
 *       - PER_DELIVERY: creates a per-delivery payout (DriverPayout
 *         for driver referrer, ReferralCredit for customer referrer)
 *         for the just-completed paid delivery. Also fires the
 *         referred party's $50-on-5th-delivery bonus when the
 *         `completedPaidDeliveries` counter crosses
 *         `perDeliveryBonusTriggerCount`.
 *
 *     PER_DELIVERY also handles Customer referrals (Customer→Customer
 *     and Customer→Driver): the per-delivery credit is created when
 *     the referred customer's delivery is paid.
 *
 * Both methods are IDEMPOTENT — safe to call multiple times.
 * They check `referral.status` and `referredRewardPaidAt` before
 * firing. A referral that has already paid out (status = REWARD_PAID)
 * will never fire again, even if the driver is re-approved or
 * completes more deliveries.
 *
 * After paying the referred driver (one-shot, TIERED only), the
 * service counts the referrer's successful referrals and fires TIER
 * payouts if the count has crossed a new multiple of
 * `referralThreshold` (read LIVE from the config — admin can adjust
 * mid-program).
 *
 * Expiry check: if `referral.expiresAt` has passed without the
 * trigger firing, the referral is marked EXPIRED and no payout
 * happens. A periodic cron (ReferralExpiryScheduler) handles
 * mass-expiration, but the trigger service also checks at fire-time
 * as a safety net.
 *
 * Active check: triggers only fire when the program isActive=true.
 * If the admin pauses the program, pending referrals stay pending
 * until either (a) the program is reactivated AND the trigger
 * fires before expiry, or (b) the expiry cron marks them EXPIRED.
 */

import { Inject, Injectable, Logger } from "@nestjs/common";
import { EnumReferralType, EnumReferralPayoutModel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";
import {
  ReferralRewardTrigger,
  ReferralTimeLimitMode,
  ReferralPayoutModelDto,
  ReferralTypeDto,
} from "../appSetting/dto/appSetting.dto";

// The Prisma-generated EnumReferralType / EnumReferralPayoutModel have the
// same string values as our DTO enums (ReferralTypeDto / ReferralPayoutModelDto)
// but TypeScript treats them as distinct types. We use the Prisma types in
// handler signatures (since that's what Prisma returns) and compare using
// the DTO enum string values (TS allows `===` comparison across two string
// enums with identical values).

@Injectable()
export class ReferralTriggerService {
  private readonly logger = new Logger(ReferralTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appSettingService: AppSettingService,
    @Inject(REFERRAL_REWARD_PAYOUT_PROVIDER)
    private readonly payoutProvider: ReferralRewardPayoutProvider,
  ) {}

  /**
   * Called when admin moves a driver to APPROVED status.
   *
   * IMPORTANT: This hook fires on EVERY approval transition —
   * PENDING_APPROVAL → APPROVED (first approval), REJECTED → APPROVED
   * (re-approval after rejection), SUSPENDED → APPROVED (re-approval
   * after suspension). The caller must pass `isFirstApproval=true`
   * ONLY for the first approval (PENDING_APPROVAL → APPROVED with
   * no prior approvedAt timestamp).
   *
   * Why: per the platform's referral model, the ON_APPROVED trigger
   * should pay out EXACTLY ONCE — when the referred driver becomes
   * a "proper signup" (admin-approved for the first time). If the
   * driver is later rejected and re-approved, or suspended and
   * re-approved, the trigger must NOT fire again. The referral
   * stays "reward paid" forever after the first payout.
   *
   * The caller (DriverApprovalEngine.approveDriver) computes
   * `isFirstApproval` by checking `driver.approvedAt` BEFORE the
   * status update — if null, this is the first approval; if set,
   * it's a re-approval.
   *
   * Safe to call multiple times — idempotent. The internal
   * `referral.status === REWARD_PAID` guard is a backstop in
   * case the caller forgets to pass `isFirstApproval`.
   *
   * @param driverId The driver who was just approved
   * @param isFirstApproval True only on the FIRST approval transition
   *   (PENDING_APPROVAL → APPROVED when approvedAt was previously null).
   *   False for re-approvals (REJECTED → APPROVED, SUSPENDED → APPROVED).
   *   Defaults to true for backward compat with callers that don't pass it.
   */
  async onDriverApproved(driverId: string, isFirstApproval: boolean = true): Promise<void> {
    try {
      // ── First-approval-only enforcement ──
      // If this is a re-approval (REJECTED → APPROVED or SUSPENDED → APPROVED),
      // the referral should NOT fire again. The referral was either:
      //   - Already paid out on the first approval (status=REWARD_PAID) →
      //     the idempotency guard below catches it
      //   - Never triggered because the program was paused / outside window
      //     at the time of first approval → it's too late now. The driver
      //     already became a "proper signup" once. We don't get a second
      //     bite at the cherry — that would be a duplicate payout.
      if (!isFirstApproval) {
        this.logger.log(
          `onDriverApproved: driver ${driverId} is being RE-approved (isFirstApproval=false) — referral trigger skipped to prevent duplicate payout`
        );
        return;
      }

      const referral = await this.prisma.referral.findFirst({
        where: { referredDriverId: driverId },
        select: {
          id: true,
          referrerId: true,
          status: true,
          rewardTrigger: true,
          requiredDeliveries: true,
          expiresAt: true,
          referredGetsReward: true,
          referredRewardAmount: true,
          referredRewardPaidAt: true,
        },
      });

      if (!referral) {
        // Driver wasn't referred — nothing to do.
        return;
      }

      // Idempotency: already paid out (backstop guard in case caller
      // mis-passed isFirstApproval, or in case the trigger fires twice
      // for the same approval event due to a retry)
      if (referral.status === "REWARD_PAID" || referral.referredRewardPaidAt) {
        this.logger.log(
          `onDriverApproved: referral ${referral.id} already paid — skipping`
        );
        return;
      }

      // Wrong trigger type — this hook is for ON_APPROVED only
      if (referral.rewardTrigger !== ReferralRewardTrigger.ON_APPROVED) {
        return;
      }

      await this.fireReferralSuccess(referral.id);
    } catch (err) {
      this.logger.error(
        `onDriverApproved failed for driver ${driverId}: ${(err as Error).message}`,
        (err as Error).stack
      );
      // Don't rethrow — we don't want to break the driver approval flow
      // if the referral trigger fails. The cron will pick up the slack.
    }
  }

  /**
   * Called when a driver completes a delivery.
   *
   * Phase 2: takes an object input `{ driverId, deliveryId, customerId? }`
   * (legacy callers that pass a bare driverId string are still accepted).
   * Branches on the referral's payoutModel:
   *
   *   - TIERED (legacy driver→driver): increments `tripsCompleted`, fires
   *     the one-shot referred-driver reward + the referrer tier payouts
   *     when `tripsCompleted >= requiredDeliveries`.
   *
   *   - PER_DELIVERY (new): creates a per-delivery payout/credit for the
   *     just-completed PAID delivery. Also fires the referred party's
   *     $50-on-5th-delivery bonus when `completedPaidDeliveries` crosses
   *     `perDeliveryBonusTriggerCount`. Handles BOTH the driver-referrer
   *     path (DriverPayout to the referrer) and the customer-referrer
   *     path (ReferralCredit to the referrer's customer account).
   *
   * Also looks up any CUSTOMER referral where the delivery's `customerId`
   * matches `Referral.referredCustomerId` — that's how customer-referrer
   * per-delivery credits are created (when the referred customer
   * completes a paid delivery).
   *
   * Safe to call multiple times — idempotent.
   *
   * Note: the "paid" condition is implicit — this method is called AFTER
   * the PaymentPayoutEngine creates the DriverPayout (TRIP_COMPLETION)
   * row, so the delivery IS considered paid. We don't separately verify
   * payment status.
   */
  async onDeliveryCompleted(
    input:
      | string
      | { driverId: string; deliveryId: string; customerId?: string },
  ): Promise<void> {
    // Backward compat: accept a bare driverId string from legacy callers.
    const normalized =
      typeof input === "string"
        ? { driverId: input, deliveryId: "", customerId: undefined as string | undefined }
        : input;

    try {
      await this.handleDriverReferralOnDelivery(normalized);
      await this.handleCustomerReferralOnDelivery(normalized);
    } catch (err) {
      this.logger.error(
        `onDeliveryCompleted failed for driver ${normalized.driverId} delivery ${normalized.deliveryId}: ${(err as Error).message}`,
        (err as Error).stack
      );
      // Don't rethrow — we don't want to break the delivery completion flow
      // if the referral trigger fails. The cron will pick up the slack.
    }
  }

  /**
   * Handle the driver-referral side of the delivery completion.
   * Looks up the referral where the DRIVER was referred
   * (`referredDriverId == driverId`), and branches on payoutModel.
   *
   * TIERED: legacy behavior (increment tripsCompleted, fire on threshold).
   * PER_DELIVERY: create per-delivery payout to driver referrer + maybe
   * fire $50-on-5th-delivery bonus to the referred driver.
   */
  private async handleDriverReferralOnDelivery(input: {
    driverId: string;
    deliveryId: string;
    customerId?: string;
  }): Promise<void> {
    const referral = await this.prisma.referral.findFirst({
      where: { referredDriverId: input.driverId },
      select: {
        id: true,
        referrerId: true,
        referrerUserId: true,
        referralType: true,
        payoutModel: true,
        status: true,
        rewardTrigger: true,
        requiredDeliveries: true,
        tripsCompleted: true,
        completedPaidDeliveries: true,
        expiresAt: true,
        referredGetsReward: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        referredDriverId: true,
      },
    });

    if (!referral) {
      // Driver wasn't referred — nothing to do.
      return;
    }

    // Idempotency: already paid out (terminal state)
    if (referral.status === "REWARD_PAID" || referral.referredRewardPaidAt) {
      return;
    }

    // Branch on payoutModel
    if (referral.payoutModel === ReferralPayoutModelDto.PER_DELIVERY) {
      await this.handlePerDeliveryDriverReferral(referral, input.deliveryId);
      return;
    }

    // ── TIERED model (legacy) ──
    // Wrong trigger type — this hook is for ON_DELIVERIES_COMPLETED only
    if (referral.rewardTrigger !== ReferralRewardTrigger.ON_DELIVERIES_COMPLETED) {
      return;
    }

    // Increment the trip counter (only if not yet completed)
    // Use a conditional update so we don't keep incrementing past the threshold.
    const updated = await this.prisma.referral.updateMany({
      where: {
        id: referral.id,
        tripsCompleted: { lt: referral.requiredDeliveries },
      },
      data: { tripsCompleted: { increment: 1 } },
    });

    if (updated.count === 0) {
      return;
    }

    // Re-fetch to get the new tripsCompleted value
    const refreshed = await this.prisma.referral.findUnique({
      where: { id: referral.id },
      select: { tripsCompleted: true, requiredDeliveries: true },
    });

    if (!refreshed) return;

    if (refreshed.tripsCompleted >= refreshed.requiredDeliveries) {
      await this.fireReferralSuccess(referral.id);
    }
  }

  /**
   * Handle the customer-referral side of the delivery completion.
   * Looks up the referral where the CUSTOMER who placed this delivery
   * was referred (`referredCustomerId == customerId`), and processes
   * the PER_DELIVERY credit creation.
   *
   * Only fires for PER_DELIVERY referrals — TIERED doesn't apply to
   * customer referred parties (a customer can't be a "tier" referrer).
   */
  private async handleCustomerReferralOnDelivery(input: {
    driverId: string;
    deliveryId: string;
    customerId?: string;
  }): Promise<void> {
    // Need the customerId to look up the customer referral. If the caller
    // didn't pass it, resolve it from the delivery.
    let customerId = input.customerId;
    if (!customerId && input.deliveryId) {
      const delivery = await this.prisma.deliveryRequest.findUnique({
        where: { id: input.deliveryId },
        select: { customerId: true },
      });
      customerId = delivery?.customerId;
    }
    if (!customerId) {
      return;
    }

    const referral = await this.prisma.referral.findFirst({
      where: { referredCustomerId: customerId },
      select: {
        id: true,
        referrerId: true,
        referrerUserId: true,
        referralType: true,
        payoutModel: true,
        status: true,
        completedPaidDeliveries: true,
        expiresAt: true,
        referredGetsReward: true,
        referredRewardAmount: true,
        referredRewardPaidAt: true,
        referredCustomerId: true,
      },
    });

    if (!referral) {
      // Customer wasn't referred — nothing to do.
      return;
    }

    // Idempotency: already paid out
    if (referral.status === "REWARD_PAID" || referral.referredRewardPaidAt) {
      return;
    }

    // Only PER_DELIVERY is supported for customer referrals
    if (referral.payoutModel !== ReferralPayoutModelDto.PER_DELIVERY) {
      return;
    }

    await this.handlePerDeliveryCustomerReferral(referral, input.deliveryId);
  }

  /**
   * PER_DELIVERY handler for a referred DRIVER.
   *
   * For each paid delivery by the referred driver:
   *   1. Create a per-delivery payout to the referrer.
   *      - Driver referrer: DriverPayout (REFERRAL_REFERRER, marked via
   *        failureMessage="PER_DELIVERY:<deliveryId>").
   *      - Customer referrer: ReferralCredit on the referrer's Customer row.
   *   2. Increment `completedPaidDeliveries`.
   *   3. When `completedPaidDeliveries` hits `perDeliveryBonusTriggerCount`,
   *      fire the one-shot $50 bonus to the referred driver (DriverPayout
   *      REFERRAL_REFERED, linked via Referral.referredPayoutId for
   *      idempotency).
   *
   * Idempotency: per-delivery payout is keyed by deliveryId (stored in
   * failureMessage for DriverPayout, in deliveryId for ReferralCredit).
   * Bonus payout is keyed by Referral.referredPayoutId (unique).
   */
  private async handlePerDeliveryDriverReferral(
    referral: {
      id: string;
      referrerId: string | null;
      referrerUserId: string | null;
      referralType: EnumReferralType | null;
      status: string;
      completedPaidDeliveries: number;
      expiresAt: Date | null;
      referredGetsReward: boolean;
      referredRewardAmount: number | null;
      referredRewardPaidAt: Date | null;
      referredDriverId: string | null;
    },
    deliveryId: string,
  ): Promise<void> {
    if (!deliveryId) {
      // No delivery context (legacy caller). Skip PER_DELIVERY — can't
      // create a per-delivery payout without knowing which delivery.
      return;
    }

    // Expiry check — if past expiresAt, mark EXPIRED and bail
    if (referral.expiresAt && referral.expiresAt < new Date()) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: "EXPIRED" },
      });
      this.logger.log(
        `Referral ${referral.id} expired before per-delivery payout could fire (expiresAt=${referral.expiresAt.toISOString()})`
      );
      return;
    }

    // Active check
    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      this.logger.log(
        `Referral ${referral.id} per-delivery payout skipped — program is paused`
      );
      return;
    }

    // ── Step 1: Create the per-delivery referrer payout/credit ──
    if (referral.referralType === ReferralTypeDto.DRIVER && referral.referrerId) {
      // Driver referrer → DriverPayout
      await this.createDriverReferrerPerDeliveryPayout({
        referrerDriverId: referral.referrerId,
        deliveryId,
        amountCents: config.perDeliveryReferrerAmountCents,
        referralId: referral.id,
      });
    } else if (referral.referralType === ReferralTypeDto.CUSTOMER && referral.referrerUserId) {
      // Customer referrer → ReferralCredit on the referrer's customer account
      const referrerCustomer = await this.prisma.customer.findUnique({
        where: { userId: referral.referrerUserId },
        select: { id: true },
      });
      if (referrerCustomer) {
        await this.createReferralCredit({
          referralId: referral.id,
          customerId: referrerCustomer.id,
          deliveryId,
          amountCents: config.perDeliveryReferrerAmountCents,
          reason: `Per-delivery referrer credit (delivery ${deliveryId})`,
        });
      }
    }

    // ── Step 2: Increment completedPaidDeliveries ──
    const incremented = await this.prisma.referral.update({
      where: { id: referral.id },
      data: { completedPaidDeliveries: { increment: 1 } },
      select: { completedPaidDeliveries: true },
    });

    // ── Step 3: Fire the $50-on-Nth-delivery bonus when the threshold is crossed ──
    if (
      referral.referredGetsReward &&
      incremented.completedPaidDeliveries === config.perDeliveryBonusTriggerCount &&
      !referral.referredRewardPaidAt &&
      referral.referredDriverId
    ) {
      const bonusAmountCents = config.perDeliveryReferredBonusCents;
      const bonusAmountDollars = bonusAmountCents / 100;

      if (bonusAmountDollars > 0) {
        await this.payoutProvider.createReferredRewardPayout({
          referredDriverId: referral.referredDriverId,
          amount: bonusAmountDollars,
          referralId: referral.id,
        });
      }

      // Mark the referral as REWARD_PAID — prevents the per-delivery
      // bonus from firing again on subsequent deliveries.
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: "REWARD_PAID" },
      });

      this.logger.log(
        `Referral ${referral.id} PER_DELIVERY bonus fired on delivery #${incremented.completedPaidDeliveries} (deliveryId=${deliveryId}) — referred driver ${referral.referredDriverId} earns $${bonusAmountDollars}`
      );
    }
  }

  /**
   * PER_DELIVERY handler for a referred CUSTOMER.
   *
   * Similar to handlePerDeliveryDriverReferral but for customer referred
   * parties. The per-delivery referrer payout is the same (DriverPayout
   * for driver referrer, ReferralCredit for customer referrer). The
   * $50-on-5th-delivery bonus goes to the REFERRED customer as a
   * ReferralCredit (not a DriverPayout, since they're not a driver).
   */
  private async handlePerDeliveryCustomerReferral(
    referral: {
      id: string;
      referrerId: string | null;
      referrerUserId: string | null;
      referralType: EnumReferralType | null;
      status: string;
      completedPaidDeliveries: number;
      expiresAt: Date | null;
      referredGetsReward: boolean;
      referredRewardAmount: number | null;
      referredRewardPaidAt: Date | null;
      referredCustomerId: string | null;
    },
    deliveryId: string,
  ): Promise<void> {
    if (!deliveryId) {
      return;
    }

    // Expiry check
    if (referral.expiresAt && referral.expiresAt < new Date()) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: "EXPIRED" },
      });
      return;
    }

    const config = await this.appSettingService.getReferralProgramSettings();
    if (!config.isActive) {
      this.logger.log(
        `Referral ${referral.id} customer per-delivery payout skipped — program is paused`
      );
      return;
    }

    // ── Step 1: Create the per-delivery referrer payout/credit ──
    if (referral.referralType === ReferralTypeDto.DRIVER && referral.referrerId) {
      // Driver referrer → DriverPayout (driver referring a customer)
      await this.createDriverReferrerPerDeliveryPayout({
        referrerDriverId: referral.referrerId,
        deliveryId,
        amountCents: config.perDeliveryReferrerAmountCents,
        referralId: referral.id,
      });
    } else if (referral.referralType === ReferralTypeDto.CUSTOMER && referral.referrerUserId) {
      // Customer referrer → ReferralCredit
      const referrerCustomer = await this.prisma.customer.findUnique({
        where: { userId: referral.referrerUserId },
        select: { id: true },
      });
      if (referrerCustomer) {
        await this.createReferralCredit({
          referralId: referral.id,
          customerId: referrerCustomer.id,
          deliveryId,
          amountCents: config.perDeliveryReferrerAmountCents,
          reason: `Per-delivery referrer credit (delivery ${deliveryId})`,
        });
      }
    }

    // ── Step 2: Increment completedPaidDeliveries ──
    const incremented = await this.prisma.referral.update({
      where: { id: referral.id },
      data: { completedPaidDeliveries: { increment: 1 } },
      select: { completedPaidDeliveries: true },
    });

    // ── Step 3: Fire the $50-on-Nth-delivery bonus to the referred customer ──
    if (
      referral.referredGetsReward &&
      incremented.completedPaidDeliveries === config.perDeliveryBonusTriggerCount &&
      !referral.referredRewardPaidAt &&
      referral.referredCustomerId
    ) {
      const bonusAmountCents = config.perDeliveryReferredBonusCents;

      if (bonusAmountCents > 0) {
        await this.createReferralCredit({
          referralId: referral.id,
          customerId: referral.referredCustomerId,
          deliveryId,
          amountCents: bonusAmountCents,
          reason: `$50-on-${config.perDeliveryBonusTriggerCount}th-delivery bonus`,
        });
      }

      // Mark the referral as REWARD_PAID + set referredRewardPaidAt
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "REWARD_PAID",
          referredRewardPaidAt: new Date(),
        },
      });

      this.logger.log(
        `Referral ${referral.id} PER_DELIVERY bonus fired on delivery #${incremented.completedPaidDeliveries} (deliveryId=${deliveryId}) — referred customer ${referral.referredCustomerId} earns ${bonusAmountCents}c credit`
      );
    }
  }

  /**
   * Create a per-delivery DriverPayout for a driver referrer (PER_DELIVERY model).
   *
   * Idempotency: the `failureMessage` field stores `PER_DELIVERY:<deliveryId>`.
   * Before creating, we check if a payout with that failureMessage already
   * exists for this driver — if so, we skip. This is race-prone (two triggers
   * could both pass the check before either creates), but the window is tiny
   * and the trigger is only called once per delivery completion by the
   * delivery-lifecycle service.
   *
   * Note: DriverPayout.deliveryId is @unique, so we set deliveryId=null
   * (the TRIP_COMPLETION payout already has the deliveryId set). The link
   * to the triggering delivery is preserved via failureMessage.
   */
  private async createDriverReferrerPerDeliveryPayout(input: {
    referrerDriverId: string;
    deliveryId: string;
    amountCents: number;
    referralId: string;
  }): Promise<void> {
    if (input.amountCents <= 0) return;

    const failureMessage = `PER_DELIVERY:${input.deliveryId}`;
    const amountDollars = input.amountCents / 100;

    // Idempotency check
    const existing = await this.prisma.driverPayout.findFirst({
      where: {
        driverId: input.referrerDriverId,
        type: "REFERRAL_REFERRER",
        failureMessage,
      },
      select: { id: true },
    });
    if (existing) {
      // Already paid for this delivery — skip.
      return;
    }

    await this.prisma.driverPayout.create({
      data: {
        driverId: input.referrerDriverId,
        deliveryId: null,
        type: "REFERRAL_REFERRER",
        status: "PENDING",
        grossAmount: amountDollars,
        netAmount: amountDollars,
        platformFee: 0,
        insuranceFee: 0,
        driverSharePct: 100,
        tierNumber: null,
        failureMessage,
      },
    });

    this.logger.log(
      `Created per-delivery referrer payout: driver=${input.referrerDriverId} delivery=${input.deliveryId} amount=$${amountDollars} referral=${input.referralId}`
    );
  }

  /**
   * Create a ReferralCredit row (for customer referrers and customer
   * referred-party bonuses).
   *
   * Idempotency: the (referralId, deliveryId, customerId) tuple uniquely
   * identifies a per-delivery credit. We check before creating. The
   * schema doesn't have a unique constraint on this tuple, so we rely
   * on the application-level check + the single-threaded trigger call
   * per delivery completion.
   */
  private async createReferralCredit(input: {
    referralId: string;
    customerId: string;
    deliveryId: string;
    amountCents: number;
    reason: string;
  }): Promise<void> {
    if (input.amountCents <= 0) return;

    // Idempotency check
    const existing = await this.prisma.referralCredit.findFirst({
      where: {
        referralId: input.referralId,
        deliveryId: input.deliveryId,
        customerId: input.customerId,
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    await this.prisma.referralCredit.create({
      data: {
        referralId: input.referralId,
        customerId: input.customerId,
        deliveryId: input.deliveryId,
        amountCents: input.amountCents,
        reason: input.reason,
        status: "PENDING",
      },
    });

    this.logger.log(
      `Created referral credit: customer=${input.customerId} delivery=${input.deliveryId} amount=${input.amountCents}c referral=${input.referralId} reason="${input.reason}"`
    );
  }

  /**
   * Fire the referral success — pays the referred driver (one-shot)
   * and then checks if the referrer has crossed a new tier.
   *
   * Idempotent at multiple levels:
   *   - Status check: if status is already REWARD_PAID, do nothing
   *   - Payout provider: createReferredRewardPayout checks
   *     Referral.referredPayoutId and returns the existing ID if set
   *   - Tier payout: createReferrerTierPayout checks for an existing
   *     payout with the same (driverId, type, tierNumber) and returns
   *     the existing ID if set
   */
  private async fireReferralSuccess(referralId: string): Promise<void> {
    // Re-fetch the referral inside a transaction to get the freshest state
    return await this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.findUnique({
        where: { id: referralId },
        select: {
          id: true,
          referrerId: true,
          referredDriverId: true,
          status: true,
          expiresAt: true,
          referredGetsReward: true,
          referredRewardAmount: true,
          referredRewardPaidAt: true,
          referredPayoutId: true,
        },
      });

      if (!referral) return;

      // Idempotency
      if (referral.status === "REWARD_PAID" || referral.referredRewardPaidAt) {
        return;
      }

      // Expiry check — if past expiresAt, mark EXPIRED and bail
      if (referral.expiresAt && referral.expiresAt < new Date()) {
        await tx.referral.update({
          where: { id: referralId },
          data: { status: "EXPIRED" },
        });
        this.logger.log(
          `Referral ${referralId} expired before trigger could fire (expiresAt=${referral.expiresAt.toISOString()})`
        );
        return;
      }

      // isActive check — read live config
      const config = await this.appSettingService.getReferralProgramSettings();
      if (!config.isActive) {
        // Program paused — don't fire now. The referral stays in its
        // current status. If the program is reactivated before
        // expiresAt, the next trigger call will fire. If not, the
        // expiry cron will mark it EXPIRED.
        this.logger.log(
          `Referral ${referralId} trigger skipped — program is paused (isActive=false)`
        );
        return;
      }

      // ── Pay the referred driver (one-shot) ──
      // The referred driver gets `referredRewardAmount` once when their
      // own referral becomes successful. The referrer's tier payout is
      // handled separately below.
      //
      // Skip if amount ≤ 0 — avoids creating a useless $0 DriverPayout
      // row (which Stripe would reject + would email the driver "you
      // earned $0.00"). The referral is still marked REWARD_PAID so it
      // counts toward the referrer's tier progress.
      if (
        referral.referredGetsReward &&
        referral.referredRewardAmount != null &&
        referral.referredRewardAmount > 0 &&
        referral.referredDriverId
      ) {
        // The payout provider is idempotent — it checks Referral.referredPayoutId
        // and returns the existing ID if set.
        await this.payoutProvider.createReferredRewardPayout({
          referredDriverId: referral.referredDriverId,
          amount: referral.referredRewardAmount,
          referralId: referral.id,
        });
      }

      // Mark the referral as REWARD_PAID (referred side paid)
      await tx.referral.update({
        where: { id: referralId },
        data: { status: "REWARD_PAID" },
      });

      // ── Check referrer tier payouts ──
      // Only driver referrers (referrerId IS NOT NULL) participate in
      // tier payouts. Customer referrers (referrerUserId set, referrerId
      // null) earn per-delivery credits, which are handled in the
      // PER_DELIVERY branch of onDeliveryCompleted, not here.
      if (referral.referrerId) {
        await this.maybeFireReferrerTierPayouts(tx, referral.referrerId);
      }

      this.logger.log(
        `Referral ${referralId} success fired — referrer=${referral.referrerId}`
      );
    });
  }

  /**
   * Check if the referrer has crossed a new tier of successful
   * referrals. If so, fire a payout for each newly-crossed tier.
   *
   * "Successful" = referral status = REWARD_PAID (the referred
   * driver met the trigger condition before expiry).
   *
   * Reads `referralThreshold` and `referrerRewardAmount` LIVE from
   * the config — the admin can adjust these mid-program.
   *
   * Race-safety:
   *   - `Driver.lastPaidReferrerTier` is incremented via a conditional
   *     `updateMany` (only if the value matches the expected old tier).
   *     This prevents two concurrent calls from both bumping past the
   *     same tier.
   *   - The DriverPayout row is protected by a DB unique constraint
   *     on (driverId, type=REFERRAL_REFERRER, tierNumber). If a race
   *     slips through, only one create() succeeds; the other catches
   *     the P2002 error and fetches the existing row.
   *
   * This makes the operation idempotent across multiple trigger calls
   * + cron runs.
   */
  private async maybeFireReferrerTierPayouts(
    tx: any,
    referrerDriverId: string
  ): Promise<void> {
    const config = await this.appSettingService.getReferralProgramSettings();
    const threshold = config.referralThreshold;
    const amount = config.referrerRewardAmount;

    if (threshold < 1 || amount <= 0) {
      return;
    }

    // Count successful referrals made by this referrer
    const successfulCount = await tx.referral.count({
      where: {
        referrerId: referrerDriverId,
        status: "REWARD_PAID",
      },
    });

    const targetTier = Math.floor(successfulCount / threshold);

    // Atomically claim tiers one at a time. Each iteration:
    //   1. Compute next tier (current lastPaid + 1)
    //   2. Try to create the DriverPayout (unique constraint catches races)
    //   3. Atomically bump lastPaidReferrerTier via conditional updateMany
    //      (only if it's still at the old value — prevents double-bump)
    //   4. If we lost the race (updateMany affected 0 rows), bail
    while (true) {
      // Re-read the referrer's lastPaidReferrerTier inside the tx
      // so we always have the freshest value.
      const referrer = await tx.driver.findUnique({
        where: { id: referrerDriverId },
        select: { lastPaidReferrerTier: true },
      });
      if (!referrer) return;

      if (referrer.lastPaidReferrerTier >= targetTier) {
        // Already paid up to or past the target tier — done.
        return;
      }

      const nextTier = referrer.lastPaidReferrerTier + 1;

      // Create the tier payout. If a race happened and the row already
      // exists, the payout provider catches the P2002 and returns the
      // existing ID — so this is safe to call repeatedly.
      const result = await this.payoutProvider.createReferrerTierPayout({
        referrerDriverId,
        amount,
        tierNumber: nextTier,
      });

      // Atomically bump lastPaidReferrerTier ONLY if it's still at
      // the old value. If another concurrent call already bumped it,
      // updateMany returns 0 — we re-loop, re-read, and skip.
      const bumpResult = await tx.driver.updateMany({
        where: {
          id: referrerDriverId,
          lastPaidReferrerTier: referrer.lastPaidReferrerTier,
        },
        data: { lastPaidReferrerTier: nextTier },
      });

      if (bumpResult.count === 0) {
        // Lost the race — another caller already bumped past nextTier.
        // Bail out; they'll handle the remaining tiers.
        this.logger.log(
          `Referrer ${referrerDriverId} tier ${nextTier} race lost to another caller — bailing`
        );
        return;
      }

      this.logger.log(
        `Referrer ${referrerDriverId} crossed tier ${nextTier} (${successfulCount} successful / ${threshold} threshold) — payout ${result.payoutId} created`
      );
    }
  }
}

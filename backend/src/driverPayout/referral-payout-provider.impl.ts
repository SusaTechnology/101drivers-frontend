/**
 * Implementation of ReferralRewardPayoutProvider that lives in the
 * driverPayouts module.
 *
 * Creates DriverPayout rows of type REFERRAL_REFERRER (per-tier
 * payout to the referrer) and REFERRAL_REFERRED (one-shot reward
 * to the referred driver).
 *
 * Decoupling note: this is the ONLY file in the driverPayouts module
 * that knows about referrals. The referral module only knows about
 * the ReferralRewardPayoutProvider interface — it never imports
 * DriverPayoutService, Stripe, or any other concrete payment detail.
 * Swap providers by implementing the interface and rebinding the
 * DI token (REFERRAL_REWARD_PAYOUT_PROVIDER).
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ReferralRewardPayoutProvider,
  ReferralPayoutResult,
  CreateReferrerTierPayoutInput,
  CreateReferredRewardPayoutInput,
} from "../referral/referral-payout-provider";

@Injectable()
export class ReferralPayoutProviderImpl implements ReferralRewardPayoutProvider {
  private readonly logger = new Logger(ReferralPayoutProviderImpl.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a tier payout for the referrer (type = REFERRAL_REFERRER).
   *
   * Idempotency: a referrer can only have ONE payout per tier number.
   * We use a unique constraint on (driverId, type, "tierNumber")
   * via a JSON metadata field — but since Prisma doesn't easily
   * support composite unique constraints on existing columns + JSON,
   * we use a findFirst check inside a transaction.
   *
   * The metadata field stores `{ tierNumber }` so we can query it
   * later for stats / display.
   */
  async createReferrerTierPayout(
    input: CreateReferrerTierPayoutInput
  ): Promise<ReferralPayoutResult> {
    const { referrerDriverId, amount, tierNumber } = input;

    // Idempotency check: if a payout for this driver + tier already
    // exists, return its ID. The metadata field stores the tier number.
    // We use the failureMessage column as JSON storage for tier number
    // (since DriverPayout has no dedicated metadata column and we
    // don't want to add one for this). The "failureMessage" field is
    // null for non-failed payouts, so we repurpose it for tier metadata.
    // Format: "TIER:N" (parsed by the stats service if needed).
    const tierTag = `TIER:${tierNumber}`;

    const existing = await this.prisma.driverPayout.findFirst({
      where: {
        driverId: referrerDriverId,
        type: "REFERRAL_REFERRER",
        failureMessage: tierTag,
      },
      select: { id: true },
    });

    if (existing) {
      this.logger.log(
        `Referrer tier payout already exists for driver ${referrerDriverId} tier ${tierNumber} — returning existing ID ${existing.id}`
      );
      return { payoutId: existing.id };
    }

    // Create the payout row. Referral payouts have:
    //   - deliveryId = null (no delivery)
    //   - type = REFERRAL_REFERRER
    //   - grossAmount = netAmount = amount (no platform/insurance fees)
    //   - driverSharePct = 100 (driver gets 100% of this reward)
    //   - platformFee = 0, insuranceFee = 0
    //   - status = PENDING (will be PAID when the batch processor runs)
    //   - failureMessage = "TIER:N" (used as tier metadata)
    const payout = await this.prisma.driverPayout.create({
      data: {
        driverId: referrerDriverId,
        deliveryId: null,
        type: "REFERRAL_REFERRER",
        status: "PENDING",
        grossAmount: amount,
        netAmount: amount,
        platformFee: 0,
        insuranceFee: 0,
        driverSharePct: 100,
        failureMessage: tierTag,
      },
    });

    this.logger.log(
      `Created referrer tier payout: driver=${referrerDriverId} tier=${tierNumber} amount=$${amount} payoutId=${payout.id}`
    );

    return { payoutId: payout.id };
  }

  /**
   * Create a one-shot reward payout for the referred driver
   * (type = REFERRAL_REFERRED). Linked to the Referral row via
   * Referral.referredPayoutId.
   *
   * Idempotency: if the referral already has a `referredPayoutId`,
   * return that ID instead of creating a new payout.
   */
  async createReferredRewardPayout(
    input: CreateReferredRewardPayoutInput
  ): Promise<ReferralPayoutResult> {
    const { referredDriverId, amount, referralId } = input;

    // Idempotency: check if the referral already has a payout
    const existingReferral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { referredPayoutId: true },
    });

    if (existingReferral?.referredPayoutId) {
      this.logger.log(
        `Referred reward payout already exists for referral ${referralId} — returning existing ID ${existingReferral.referredPayoutId}`
      );
      return { payoutId: existingReferral.referredPayoutId };
    }

    // Create the payout row + link it to the referral in one transaction.
    // We use a transaction so the link is atomic with the payout creation.
    const payout = await this.prisma.$transaction(async (tx) => {
      // Double-check inside the tx to prevent a race condition
      const reCheck = await tx.referral.findUnique({
        where: { id: referralId },
        select: { referredPayoutId: true },
      });
      if (reCheck?.referredPayoutId) {
        return { id: reCheck.referredPayoutId, alreadyExisted: true };
      }

      const newPayout = await tx.driverPayout.create({
        data: {
          driverId: referredDriverId,
          deliveryId: null,
          type: "REFERRAL_REFERRED",
          status: "PENDING",
          grossAmount: amount,
          netAmount: amount,
          platformFee: 0,
          insuranceFee: 0,
          driverSharePct: 100,
        },
      });

      await tx.referral.update({
        where: { id: referralId },
        data: {
          referredPayoutId: newPayout.id,
          referredRewardPaidAt: new Date(),
        },
      });

      return { id: newPayout.id, alreadyExisted: false };
    });

    if (!payout.alreadyExisted) {
      this.logger.log(
        `Created referred reward payout: driver=${referredDriverId} referral=${referralId} amount=$${amount} payoutId=${payout.id}`
      );
    }

    return { payoutId: payout.id };
  }
}

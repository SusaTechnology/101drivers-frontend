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
 *
 * Idempotency:
 *   - REFERRAL_REFERRER payouts: enforced by a DB unique constraint
 *     on (driverId, type, tierNumber). If two trigger calls race,
 *     only one create() succeeds; the other throws a unique-constraint
 *     error which we catch and treat as "already paid — fetch existing".
 *   - REFERRAL_REFERRED payouts: enforced by Referral.referredPayoutId
 *     being @unique. The idempotency check + atomic upsert happens
 *     inside a transaction.
 */

import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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
   * Idempotency: enforced by the unique constraint on
   * (driverId, type, tierNumber). If a payout for this driver + tier
   * already exists, the create() will throw a unique-constraint error
   * (Prisma's P2002 error code), and we catch it and fetch the
   * existing row.
   *
   * This is RACE-SAFE: if two trigger calls fire simultaneously when
   * a referrer crosses a tier boundary, only one create() will
   * succeed; the other gets the P2002 error and falls back to the
   * existing row.
   */
  async createReferrerTierPayout(
    input: CreateReferrerTierPayoutInput
  ): Promise<ReferralPayoutResult> {
    const { referrerDriverId, amount, tierNumber } = input;

    try {
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
          tierNumber,
        },
      });

      this.logger.log(
        `Created referrer tier payout: driver=${referrerDriverId} tier=${tierNumber} amount=$${amount} payoutId=${payout.id}`
      );

      return { payoutId: payout.id };
    } catch (err: any) {
      // P2002 = unique constraint violation — someone else already
      // created this tier payout (race condition resolved by the DB).
      if (err?.code === "P2002") {
        this.logger.log(
          `Referrer tier payout already exists for driver ${referrerDriverId} tier ${tierNumber} (race resolved by DB) — fetching existing ID`
        );
        const existing = await this.prisma.driverPayout.findFirst({
          where: {
            driverId: referrerDriverId,
            type: "REFERRAL_REFERRER",
            tierNumber,
          },
          select: { id: true },
        });
        if (existing) {
          return { payoutId: existing.id };
        }
        // Should not happen — but if the row vanished between the
        // P2002 and the findFirst, fall through and re-throw.
      }
      throw err;
    }
  }

  /**
   * Create a one-shot reward payout for the referred driver
   * (type = REFERRAL_REFERRED). Linked to the Referral row via
   * Referral.referredPayoutId.
   *
   * Idempotency: if the referral already has a `referredPayoutId`,
   * return that ID instead of creating a new payout.
   *
   * Race-safe: the check + create happen inside a transaction with
   * a re-check inside the tx, so concurrent calls can't create
   * duplicate payouts.
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
          // tierNumber is null for REFERRAL_REFERRED (it's a one-shot
          // reward, not a tier payout). The unique constraint on
          // (driverId, type, tierNumber) doesn't apply when tierNumber
          // is null (Postgres treats NULLs as distinct).
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

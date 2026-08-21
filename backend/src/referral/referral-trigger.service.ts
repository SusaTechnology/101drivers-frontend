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
 *   onDeliveryCompleted(driverId)
 *     Called when a driver completes a delivery. Increments the
 *     referral's tripsCompleted counter, then fires the trigger
 *     ONLY IF the referral's snapshotted policy is
 *     rewardTrigger = ON_DELIVERIES_COMPLETED AND the counter has
 *     just crossed `requiredDeliveries`.
 *
 * Both methods are IDEMPOTENT — safe to call multiple times.
 * They check `referral.status` and `referredRewardPaidAt` before
 * firing. A referral that has already paid out (status = REWARD_PAID)
 * will never fire again, even if the driver is re-approved or
 * completes more deliveries.
 *
 * After paying the referred driver (one-shot), the service counts
 * the referrer's successful referrals and fires TIER payouts if
 * the count has crossed a new multiple of `referralThreshold` (read
 * LIVE from the config — admin can adjust mid-program).
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
import { PrismaService } from "../prisma/prisma.service";
import { AppSettingService } from "../appSetting/appSetting.service";
import {
  REFERRAL_REWARD_PAYOUT_PROVIDER,
  ReferralRewardPayoutProvider,
} from "./referral-payout-provider";
import { ReferralRewardTrigger, ReferralTimeLimitMode } from "../appSetting/dto/appSetting.dto";

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
   * Called when admin moves a driver from PENDING_APPROVAL → APPROVED.
   *
   * Looks up the referral where this driver is the referred driver,
   * checks if the snapshotted policy is rewardTrigger = ON_APPROVED,
   * and if so, fires the payout (subject to isActive + expiry checks).
   *
   * Safe to call multiple times — idempotent.
   */
  async onDriverApproved(driverId: string): Promise<void> {
    try {
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

      // Idempotency: already paid out
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
   * Increments the referral's tripsCompleted counter, then checks if
   * the snapshotted policy is rewardTrigger = ON_DELIVERIES_COMPLETED
   * AND the counter has just crossed `requiredDeliveries`. If so,
   * fires the payout (subject to isActive + expiry checks).
   *
   * Safe to call multiple times — idempotent.
   */
  async onDeliveryCompleted(driverId: string): Promise<void> {
    try {
      const referral = await this.prisma.referral.findFirst({
        where: { referredDriverId: driverId },
        select: {
          id: true,
          referrerId: true,
          status: true,
          rewardTrigger: true,
          requiredDeliveries: true,
          tripsCompleted: true,
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

      // Idempotency: already paid out
      if (referral.status === "REWARD_PAID" || referral.referredRewardPaidAt) {
        return;
      }

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

      // If no rows updated, either:
      //  - The referral was already at requiredDeliveries (already incremented)
      //  - The referral was already paid out (caught above)
      // Either way, we don't fire again.
      if (updated.count === 0) {
        return;
      }

      // Re-fetch to get the new tripsCompleted value
      const refreshed = await this.prisma.referral.findUnique({
        where: { id: referral.id },
        select: { tripsCompleted: true, requiredDeliveries: true },
      });

      if (!refreshed) return;

      // Only fire if we've just hit (or exceeded) the threshold.
      // The updateMany above only increments if tripsCompleted < requiredDeliveries,
      // so the new value is at most requiredDeliveries. We fire when == requiredDeliveries.
      if (refreshed.tripsCompleted >= refreshed.requiredDeliveries) {
        await this.fireReferralSuccess(referral.id);
      }
    } catch (err) {
      this.logger.error(
        `onDeliveryCompleted failed for driver ${driverId}: ${(err as Error).message}`,
        (err as Error).stack
      );
      // Don't rethrow — we don't want to break the delivery completion flow
      // if the referral trigger fails. The cron will pick up the slack.
    }
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
      if (
        referral.referredGetsReward &&
        referral.referredRewardAmount != null &&
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
      await this.maybeFireReferrerTierPayouts(tx, referral.referrerId);

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
   * Uses `Driver.lastPaidReferrerTier` to track which tiers have
   * already been paid out. This makes the operation idempotent
   * across multiple trigger calls + cron runs.
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

    // Read the referrer's last paid tier (atomic with a row lock via findUnique)
    const referrer = await tx.driver.findUnique({
      where: { id: referrerDriverId },
      select: { lastPaidReferrerTier: true },
    });

    if (!referrer) return;

    const currentTier = Math.floor(successfulCount / threshold);

    // Fire payouts for any newly-crossed tiers
    // E.g. lastPaidTier=0, currentTier=2 → fire tier 1 + tier 2
    while (referrer.lastPaidReferrerTier < currentTier) {
      const nextTier = referrer.lastPaidReferrerTier + 1;

      // Use the payout provider (idempotent — checks for existing payout)
      const result = await this.payoutProvider.createReferrerTierPayout({
        referrerDriverId,
        amount,
        tierNumber: nextTier,
      });

      // Increment the counter (atomic)
      await tx.driver.update({
        where: { id: referrerDriverId },
        data: { lastPaidReferrerTier: nextTier },
      });

      referrer.lastPaidReferrerTier = nextTier;

      this.logger.log(
        `Referrer ${referrerDriverId} crossed tier ${nextTier} (${successfulCount} successful / ${threshold} threshold) — payout ${result.payoutId} created`
      );
    }
  }
}

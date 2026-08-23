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

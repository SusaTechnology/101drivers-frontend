import { Injectable, Logger, Optional, Inject } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorType,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeliveryLifecycleService } from "./delivery-lifecycle.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { StripeService } from "../providers/stripe/stripe.service";
import { businessNow } from "./business-time";

/**
 * Scheduled tasks that automatically expire stale deliveries.
 *
 * LISTED  → EXPIRED : every 15 min, if pickupWindowEnd < now
 *   ↳ Also cancels any held Stripe PaymentIntent (releases the auth hold on
 *     the customer's card) so we don't leave orphan authorizations.
 * DRAFT   → EXPIRED : every hour, if updatedAt > 7 days ago
 * QUOTED  → EXPIRED : every hour, if createdAt > 48 hours ago and not yet listed
 * BOOKED  → LISTED  : every 15 min, if pickupWindowEnd < now (driver ghosted)
 * ACTIVE  → flag    : every hour, if updatedAt > 24 hours ago (stale alert, no transition)
 *
 * Orphan-auth sweep: once per day at 03:00 server time, cancels any EXPIRED
 * delivery's stale Stripe PaymentIntent that the LISTED-expiry cron missed
 * (e.g. due to a transient Stripe outage at the moment of expiry).
 *
 * Daily is sufficient because:
 *   - Stripe auto-releases uncaptured authorizations after 7 days regardless.
 *   - The inline release in `expireListedDeliveries` already handles the
 *     happy path (sweep only catches the rare miss).
 *   - A daily batch keeps Stripe API call volume low and predictable.
 */
@Injectable()
export class DeliveryExpiryScheduler {
  private readonly logger = new Logger(DeliveryExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: DeliveryLifecycleService,
    private readonly notifications: NotificationEventEngine,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {}

  /**
   * Expire LISTED deliveries whose pickup window has fully passed.
   * Runs every 15 minutes.
   */
  @Cron("*/15 * * * *")
  async expireListedDeliveries() {
    const now = businessNow().toJSDate();

    const staleListed = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.LISTED,
        pickupWindowEnd: { lt: now },
      },
      select: {
        id: true,
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            paymentType: true,
            providerPaymentIntentId: true,
            lockInAmount: true,
          },
        },
      },
      take: 100,
    });

    if (staleListed.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${staleListed.length} LISTED delivery(ies) past pickup window`
    );

    let expired = 0;
    let failed = 0;
    let authsReleased = 0;
    let authReleaseFailures = 0;

    for (const delivery of staleListed) {
      try {
        await this.lifecycle.transitionStatus(
          delivery.id,
          EnumDeliveryRequestStatus.EXPIRED,
          {
            actorType: EnumDeliveryStatusHistoryActorType.SYSTEM,
            note: "Auto-expired: pickup window has passed",
          }
        );

        // Release the Stripe authorization hold (if any) so the customer's
        // card isn't held for 7 days. LISTED deliveries should never have a
        // captured charge (capture only happens at trip start), so the PI
        // should be in `requires_capture` state and cancellable.
        const releaseResult = await this.releaseStripeAuthOnExpiry(delivery);
        if (releaseResult.attempted && releaseResult.success) {
          authsReleased++;
        } else if (releaseResult.attempted && !releaseResult.success) {
          authReleaseFailures++;
        }

        await this.notifications.notifyDeliveryExpired({
          deliveryId: delivery.id,
          reason: "pickup_window_passed",
        });

        expired++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to expire LISTED delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `LISTED expiry complete: ${expired} expired, ${failed} failed, ` +
        `${authsReleased} Stripe auth(s) released, ${authReleaseFailures} auth release failures`
    );
  }

  /**
   * Expire old DRAFT deliveries that have not been updated in 7 days.
   * Runs every hour at minute 10.
   */
  @Cron("10 * * * *")
  async expireStaleDrafts() {
    const cutoff = businessNow().minus({ days: 7 }).toJSDate();

    const staleDrafts = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.DRAFT,
        updatedAt: { lt: cutoff },
      },
      select: { id: true },
      take: 100,
    });

    if (staleDrafts.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${staleDrafts.length} stale DRAFT delivery(ies) older than 7 days`
    );

    let expired = 0;
    let failed = 0;

    for (const delivery of staleDrafts) {
      try {
        await this.lifecycle.transitionStatus(
          delivery.id,
          EnumDeliveryRequestStatus.EXPIRED,
          {
            actorType: EnumDeliveryStatusHistoryActorType.SYSTEM,
            note: "Auto-expired: draft inactive for 7 days",
          }
        );

        await this.notifications.notifyDeliveryExpired({
          deliveryId: delivery.id,
          reason: "draft_stale_7_days",
        });

        expired++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to expire DRAFT delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `DRAFT expiry complete: ${expired} expired, ${failed} failed`
    );
  }

  /**
   * Expire QUOTED deliveries that were created more than 48 hours ago
   * and have not been listed yet.
   * Runs every hour at minute 25.
   */
  @Cron("25 * * * *")
  async expireStaleQuoted() {
    const cutoff = businessNow().minus({ hours: 48 }).toJSDate();

    const staleQuoted = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.QUOTED,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: 100,
    });

    if (staleQuoted.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${staleQuoted.length} QUOTED delivery(ies) older than 48 hours`
    );

    let expired = 0;
    let failed = 0;

    for (const delivery of staleQuoted) {
      try {
        await this.lifecycle.transitionStatus(
          delivery.id,
          EnumDeliveryRequestStatus.EXPIRED,
          {
            actorType: EnumDeliveryStatusHistoryActorType.SYSTEM,
            note: "Auto-expired: quoted but not listed within 48 hours",
          }
        );

        await this.notifications.notifyDeliveryExpired({
          deliveryId: delivery.id,
          reason: "quoted_stale_48_hours",
        });

        expired++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to expire QUOTED delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `QUOTED expiry complete: ${expired} expired, ${failed} failed`
    );
  }

  /**
   * Revert BOOKED deliveries to LISTED if the pickup window has passed
   * without the driver starting the trip (driver ghosted).
   * Runs every 15 minutes.
   */
  @Cron("*/15 * * * *")
  async revertStaleBookedDeliveries() {
    const now = businessNow().toJSDate();

    const staleBooked = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.BOOKED,
        pickupWindowEnd: { lt: now },
      },
      select: { id: true },
      take: 100,
    });

    if (staleBooked.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${staleBooked.length} BOOKED delivery(ies) past pickup window`
    );

    let reverted = 0;
    let failed = 0;

    for (const delivery of staleBooked) {
      try {
        await this.lifecycle.transitionStatus(
          delivery.id,
          EnumDeliveryRequestStatus.LISTED,
          {
            actorType: EnumDeliveryStatusHistoryActorType.SYSTEM,
            note: "Auto-reverted: driver did not start before pickup window ended",
          }
        );

        await this.notifications.notifyDeliveryRevertedToListed({
          deliveryId: delivery.id,
          reason: "pickup_window_passed",
        });

        reverted++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to revert BOOKED delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `BOOKED revert complete: ${reverted} reverted, ${failed} failed`
    );
  }

  /**
   * Flag ACTIVE deliveries that have been active for 24+ hours.
   * Sends a notification email to the dealer — does NOT change the status.
   * Humans decide what to do (close, revert, or wait).
   * Runs every hour at minute 40.
   */
  @Cron("40 * * * *")
  async flagStaleActiveDeliveries() {
    const cutoff = businessNow().minus({ hours: 24 }).toJSDate();

    const staleActive = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.ACTIVE,
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        updatedAt: true,
      },
      take: 100,
    });

    if (staleActive.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${staleActive.length} ACTIVE delivery(ies) stale for 24+ hours`
    );

    let notified = 0;
    let failed = 0;

    for (const delivery of staleActive) {
      try {
        const hoursStale =
          (Date.now() - new Date(delivery.updatedAt).getTime()) /
          (1000 * 60 * 60);

        await this.notifications.notifyStaleActiveDelivery({
          deliveryId: delivery.id,
          hoursStale,
        });

        notified++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to notify stale ACTIVE delivery ${delivery.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    this.logger.log(
      `Stale ACTIVE flag complete: ${notified} notified, ${failed} failed`
    );
  }

  /**
   * Orphan-auth sweep: cancels any EXPIRED delivery's stale Stripe
   * PaymentIntent that the LISTED-expiry cron missed.
   *
   * This catches cases like:
   *  - A transient Stripe outage at the moment of expiry (the inline release
   *    failed but the cron already moved on).
   *  - DRAFT/QUOTED deliveries that somehow have an AUTHORIZED Payment row
   *    from a previous bug.
   *  - Payments left in AUTHORIZED state from before this sweep was deployed.
   *
   * Runs once per day at 03:00 server time. Daily is sufficient because
   * Stripe auto-releases uncaptured auths after 7 days; this sweep just
   * releases them earlier than that for customer-card-hold UX.
   */
  @Cron("0 3 * * *")
  async releaseOrphanStripeAuths() {
    if (!this.stripeService) {
      return;
    }

    // Find EXPIRED deliveries with a Payment row that's still AUTHORIZED and
    // has a Stripe PaymentIntent id. These are orphan auths that need to be
    // released.
    const orphans = await this.prisma.deliveryRequest.findMany({
      where: {
        status: EnumDeliveryRequestStatus.EXPIRED,
        payment: {
          status: EnumPaymentStatus.AUTHORIZED,
          provider: EnumPaymentProvider.STRIPE,
          providerPaymentIntentId: { not: null },
          // Don't touch payments that have a lock-in (those are ACTIVE trips
          // that were cancelled mid-trip — different flow).
          lockInAmount: null,
        },
      },
      select: {
        id: true,
        payment: {
          select: {
            id: true,
            providerPaymentIntentId: true,
            amount: true,
          },
        },
      },
      take: 100,
    });

    if (orphans.length === 0) {
      return;
    }

    this.logger.log(
      `Orphan-auth sweep: found ${orphans.length} EXPIRED delivery(ies) with stale Stripe auth`
    );

    let released = 0;
    let failed = 0;

    for (const delivery of orphans) {
      const piId = delivery.payment?.providerPaymentIntentId;
      if (!piId) continue;

      try {
        await this.stripeService.cancelPaymentIntent(piId);

        // Mark the Payment row as VOIDED so we don't try to cancel it again
        // on the next sweep. Use update (not updateMany) so we get a typed
        // error if the row was modified concurrently.
        await this.prisma.payment.update({
          where: { id: delivery.payment!.id },
          data: {
            status: EnumPaymentStatus.VOIDED,
            voidedAt: businessNow().toJSDate(),
          },
        });

        this.logger.log(
          `Orphan-auth sweep: cancelled PI ${piId} and voided Payment ${delivery.payment!.id} ` +
            `for EXPIRED delivery ${delivery.id} (released $${delivery.payment!.amount} hold)`
        );
        released++;
      } catch (error: any) {
        // Stripe throws `invalid_request_error` if the PI is already in a
        // terminal state (e.g. it was auto-released by Stripe after 7 days,
        // or already cancelled by another code path). In that case, mark
        // the Payment as VOIDED so we don't keep retrying.
        const isAlreadyTerminal =
          error?.type === "invalid_request_error" ||
          error?.code === "payment_intent_unexpected_state";
        if (isAlreadyTerminal) {
          try {
            await this.prisma.payment.update({
              where: { id: delivery.payment!.id },
              data: {
                status: EnumPaymentStatus.VOIDED,
                voidedAt: businessNow().toJSDate(),
              },
            });
            this.logger.log(
              `Orphan-auth sweep: PI ${piId} for delivery ${delivery.id} was already ` +
                `terminal on Stripe; marked Payment as VOIDED.`
            );
            released++;
          } catch (dbErr) {
            failed++;
            this.logger.error(
              `Orphan-auth sweep: PI ${piId} was terminal on Stripe, but DB update failed: ${dbErr}`
            );
          }
        } else {
          failed++;
          this.logger.error(
            `Orphan-auth sweep: failed to cancel PI ${piId} for delivery ${delivery.id}: ${error.message}`
          );
        }
      }
    }

    this.logger.log(
      `Orphan-auth sweep complete: ${released} released, ${failed} failed`
    );
  }

  /**
   * Release the Stripe authorization hold on a delivery that's transitioning
   * to EXPIRED. Called inline from `expireListedDeliveries` right after the
   * status transition.
   *
   * Returns whether an attempt was made and whether it succeeded, so the
   * caller can log stats. Never throws — failures are logged and the orphan
   * sweep will retry later.
   *
   * Safety: only cancels PIs that are in AUTHORIZED state with NO lock-in
   * (i.e. the trip never started). If a lock-in was captured (shouldn't
   * happen on a LISTED delivery, but defensive), we leave the PI alone and
   * let an admin handle it.
   */
  private async releaseStripeAuthOnExpiry(delivery: {
    id: string;
    payment: {
      id: string;
      amount: number;
      status: EnumPaymentStatus;
      provider: EnumPaymentProvider;
      paymentType: EnumPaymentPaymentType;
      providerPaymentIntentId: string | null;
      lockInAmount: number | null;
    } | null;
  }): Promise<{ attempted: boolean; success: boolean }> {
    const payment = delivery.payment;

    // No Payment row → nothing to release.
    if (!payment) {
      return { attempted: false, success: false };
    }

    // POSTPAID → no Stripe auth to release (provider is MANUAL).
    if (payment.paymentType === EnumPaymentPaymentType.POSTPAID) {
      return { attempted: false, success: false };
    }

    // Not a Stripe payment → nothing to release.
    if (payment.provider !== EnumPaymentProvider.STRIPE) {
      return { attempted: false, success: false };
    }

    // Payment is not in AUTHORIZED state → already captured/refunded/voided.
    if (payment.status !== EnumPaymentStatus.AUTHORIZED) {
      return { attempted: false, success: false };
    }

    // A lock-in was captured (trip started). This shouldn't happen on a
    // LISTED delivery, but if it does, don't touch the PI — admin needs to
    // figure out what went wrong.
    if (payment.lockInAmount != null && payment.lockInAmount > 0) {
      this.logger.warn(
        `releaseStripeAuthOnExpiry: delivery ${delivery.id} has a lock-in amount ` +
          `($${payment.lockInAmount}) but is being expired from LISTED. Skipping PI ` +
          `cancellation — admin must investigate.`
      );
      return { attempted: false, success: false };
    }

    const piId = payment.providerPaymentIntentId;
    if (!piId) {
      return { attempted: false, success: false };
    }

    if (!this.stripeService) {
      this.logger.warn(
        `releaseStripeAuthOnExpiry: StripeService not configured. Cannot cancel PI ${piId} ` +
          `for delivery ${delivery.id}. The orphan-auth sweep will retry.`
      );
      return { attempted: true, success: false };
    }

    try {
      await this.stripeService.cancelPaymentIntent(piId);

      // Mark the Payment row as VOIDED so we don't try to cancel it again.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: EnumPaymentStatus.VOIDED,
          voidedAt: businessNow().toJSDate(),
        },
      });

      this.logger.log(
        `releaseStripeAuthOnExpiry: cancelled PI ${piId} and voided Payment ${payment.id} ` +
          `for delivery ${delivery.id} (released $${payment.amount} hold)`
      );
      return { attempted: true, success: true };
    } catch (error: any) {
      // If Stripe says the PI is already terminal, mark the Payment as VOIDED
      // so the orphan sweep doesn't keep retrying.
      const isAlreadyTerminal =
        error?.type === "invalid_request_error" ||
        error?.code === "payment_intent_unexpected_state";
      if (isAlreadyTerminal) {
        try {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: EnumPaymentStatus.VOIDED,
              voidedAt: businessNow().toJSDate(),
            },
          });
          this.logger.log(
            `releaseStripeAuthOnExpiry: PI ${piId} for delivery ${delivery.id} was already ` +
              `terminal on Stripe; marked Payment as VOIDED.`
          );
          return { attempted: true, success: true };
        } catch (dbErr) {
          this.logger.error(
            `releaseStripeAuthOnExpiry: PI ${piId} was terminal on Stripe, but DB update ` +
              `failed for delivery ${delivery.id}: ${dbErr}`
          );
          return { attempted: true, success: false };
        }
      }

      this.logger.error(
        `releaseStripeAuthOnExpiry: failed to cancel PI ${piId} for delivery ${delivery.id}: ${error.message}. ` +
          `The orphan-auth sweep will retry on the next run.`
      );
      return { attempted: true, success: false };
    }
  }
}

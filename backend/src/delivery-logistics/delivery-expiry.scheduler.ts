import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeliveryLifecycleService } from "./delivery-lifecycle.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { businessNow } from "./business-time";

/**
 * Scheduled tasks that automatically expire stale deliveries.
 *
 * LISTED  → EXPIRED : every 15 min, if pickupWindowEnd < now
 * DRAFT   → EXPIRED : every hour, if updatedAt > 7 days ago
 * QUOTED  → EXPIRED : every hour, if createdAt > 48 hours ago and not yet listed
 * BOOKED  → LISTED  : every 15 min, if pickupWindowEnd < now (driver ghosted)
 * ACTIVE  → flag    : every hour, if updatedAt > 24 hours ago (stale alert, no transition)
 */
@Injectable()
export class DeliveryExpiryScheduler {
  private readonly logger = new Logger(DeliveryExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: DeliveryLifecycleService,
    private readonly notifications: NotificationEventEngine
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
      select: { id: true },
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
      `LISTED expiry complete: ${expired} expired, ${failed} failed`
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
}

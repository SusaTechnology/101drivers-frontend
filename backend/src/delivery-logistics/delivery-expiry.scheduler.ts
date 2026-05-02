import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeliveryLifecycleService } from "./delivery-lifecycle.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";

/**
 * Scheduled tasks that automatically expire stale deliveries.
 *
 * LISTED  → EXPIRED : every 15 min, if pickupWindowEnd < now
 * DRAFT   → EXPIRED : every hour, if updatedAt > 7 days ago
 * QUOTED  → EXPIRED : every hour, if createdAt > 48 hours ago and not yet listed
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
    const now = new Date();

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
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

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
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

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
}

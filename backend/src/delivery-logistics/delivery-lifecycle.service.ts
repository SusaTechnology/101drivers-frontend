import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { businessStartOfDay, businessNow, toBusinessDateTime, BUSINESS_TZ } from "./business-time";
import { DateTime } from "luxon";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryFromStatus,
  EnumDeliveryStatusHistoryToStatus,
  EnumTrackingSessionStatus,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../prisma/prisma.service";
import { TrackingGateway } from "../gateways/tracking.gateway";
import { Inject, forwardRef, Optional } from "@nestjs/common";
import { DriverJobFeedService } from "./driver-job-feed.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { DeliveryComplianceEngine } from "../domain/deliveryCompliance/deliveryCompliance.engine";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import { Logger } from "@nestjs/common";

type Tx = Prisma.TransactionClient;

type StatusActor = {
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
  actorType?: EnumDeliveryStatusHistoryActorType;
  note?: string | null;
};

@Injectable()
export class DeliveryLifecycleService {
  private readonly logger = new Logger(DeliveryLifecycleService.name);
  private readonly appDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverJobFeedService: DriverJobFeedService,
    private readonly notificationEventEngine: NotificationEventEngine,
    private readonly deliveryComplianceEngine: DeliveryComplianceEngine,
    private readonly paymentPayoutEngine: PaymentPayoutEngine,
    private readonly configService: ConfigService,
    @Optional() @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway?: TrackingGateway
  ) {
    this.logger.log(
      `TrackingGateway ${this.trackingGateway ? 'INJECTED' : 'NOT INJECTED (undefined)'}`
    );
    this.appDomain = this.normalizeBaseUrl(
      this.configService.get<string>("101_DOMAIN") ??
        "https://101drivers.techbee.et"
    );
  }

  private normalizeBaseUrl(url: string): string {
    return (url || "").trim().replace(/\/+$/, "");
  }

  /**
   * Emit socket events after a status change (fire-and-forget).
   * Single query with Prisma include to fetch dealerId + shareToken for room targeting.
   */
  private emitStatusChanged(deliveryId: string, status: string): void {
    if (!this.trackingGateway) return;
    const gateway = this.trackingGateway;
    this.prisma.deliveryRequest
      .findUnique({
        where: { id: deliveryId },
        select: {
          trackingShareToken: true,
          customer: { select: { id: true } },
        },
      })
      .then((row) => {
        if (!row) return;
        try {
          gateway.emitStatusChange({
            deliveryId,
            status,
            dealerId: row.customer?.id ?? undefined,
            shareToken: row.trackingShareToken ?? undefined,
          });
          if (["LISTED", "BOOKED", "CANCELLED", "EXPIRED"].includes(status)) {
            gateway.emitFeedUpdate({ deliveryId, status });
          }
        } catch (err) {
          this.logger.warn("Failed to emit status change via WebSocket:", err);
        }
      })
      .catch(() => {});
  }

  private readonly allowedTransitions: Record<
    EnumDeliveryRequestStatus,
    EnumDeliveryRequestStatus[]
  > = {
    [EnumDeliveryRequestStatus.DRAFT]: [
      EnumDeliveryRequestStatus.QUOTED,
      EnumDeliveryRequestStatus.CANCELLED,
      EnumDeliveryRequestStatus.EXPIRED,
    ],
    [EnumDeliveryRequestStatus.QUOTED]: [
      EnumDeliveryRequestStatus.LISTED,
      EnumDeliveryRequestStatus.CANCELLED,
      EnumDeliveryRequestStatus.EXPIRED,
      EnumDeliveryRequestStatus.DRAFT,
    ],
    [EnumDeliveryRequestStatus.LISTED]: [
      EnumDeliveryRequestStatus.BOOKED,
      EnumDeliveryRequestStatus.CANCELLED,
      EnumDeliveryRequestStatus.EXPIRED,
      EnumDeliveryRequestStatus.DISPUTED,
    ],
    [EnumDeliveryRequestStatus.BOOKED]: [
      EnumDeliveryRequestStatus.ACTIVE,
      EnumDeliveryRequestStatus.COMPLETED,
      EnumDeliveryRequestStatus.CLOSED,
      EnumDeliveryRequestStatus.CANCELLED,
      EnumDeliveryRequestStatus.DISPUTED,
      EnumDeliveryRequestStatus.LISTED,
    ],
    [EnumDeliveryRequestStatus.ACTIVE]: [
      EnumDeliveryRequestStatus.COMPLETED,
      EnumDeliveryRequestStatus.CLOSED,
      EnumDeliveryRequestStatus.DISPUTED,
      EnumDeliveryRequestStatus.CANCELLED,
    ],
    [EnumDeliveryRequestStatus.COMPLETED]: [
      EnumDeliveryRequestStatus.DISPUTED,
    ],
    [EnumDeliveryRequestStatus.CLOSED]: [
      EnumDeliveryRequestStatus.DISPUTED,
    ],
    [EnumDeliveryRequestStatus.CANCELLED]: [],
    [EnumDeliveryRequestStatus.EXPIRED]: [
      EnumDeliveryRequestStatus.QUOTED,
    ],
    [EnumDeliveryRequestStatus.DISPUTED]: [],
  };

  async transitionStatus(
    deliveryId: string,
    toStatus: EnumDeliveryRequestStatus,
    actor: StatusActor = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: deliveryId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!delivery) {
        throw new NotFoundException("Delivery request not found");
      }

      if (delivery.status === toStatus) {
        return delivery;
      }

      this.assertTransitionAllowed(delivery.status, toStatus);
      await this.assertTransitionGuards(tx, delivery.id, delivery.status, toStatus);

      // When reverting from BOOKED/ACTIVE back to LISTED, release the active
      // assignment so the delivery becomes visible in the driver job feed again.
      if (
        (delivery.status === EnumDeliveryRequestStatus.BOOKED ||
          delivery.status === EnumDeliveryRequestStatus.ACTIVE) &&
        toStatus === EnumDeliveryRequestStatus.LISTED
      ) {
        await tx.deliveryAssignment.updateMany({
          where: {
            deliveryId: delivery.id,
            unassignedAt: null,
          },
          data: {
            unassignedAt: new Date(),
          },
        });
      }

      const updated = await tx.deliveryRequest.update({
        where: { id: delivery.id },
        data: { status: toStatus },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          actorUserId: actor.actorUserId ?? null,
          actorRole: actor.actorRole ?? null,
          actorType: actor.actorType ?? EnumDeliveryStatusHistoryActorType.USER,
          note: actor.note ?? null,
          fromStatus:
            delivery.status as unknown as EnumDeliveryStatusHistoryFromStatus,
          toStatus: toStatus as unknown as EnumDeliveryStatusHistoryToStatus,
        },
      });

      return updated;
    }).then((updated) => {
      this.emitStatusChanged(deliveryId, toStatus);
      return updated;
    });
  }

async bookDelivery(input: {
  deliveryId: string;
  driverId: string;
  bookedByUserId?: string | null;
  reason?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
}) {
  return this.prisma.$transaction(async (tx) => {
    await this.driverJobFeedService.assertDriverCanBookDelivery(tx, {
      driverId: input.driverId,
      deliveryId: input.deliveryId,
      driverLat: input.driverLat ?? null,
      driverLng: input.driverLng ?? null,
    });

    // Generate pickup PIN if not already set
    const existingDelivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: { pickupPin: true },
    });
    const pickupPin = existingDelivery?.pickupPin ?? this.generatePickupPin();

    const booking = await tx.deliveryAssignment.create({
      data: {
        deliveryId: input.deliveryId,
        driverId: input.driverId,
        assignedByUserId: input.bookedByUserId ?? null,
        reason: input.reason ?? null,
      },
    });

    await tx.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.BOOKED,
        ...(existingDelivery?.pickupPin ? {} : { pickupPin }),
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.bookedByUserId ?? null,
        actorRole: EnumDeliveryStatusHistoryActorRole.DRIVER,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        note: input.reason ?? "Driver booked listed job",
        fromStatus: EnumDeliveryStatusHistoryFromStatus.LISTED,
        toStatus: EnumDeliveryStatusHistoryToStatus.BOOKED,
      },
    });

    return booking;
  }).then(async (booking) => {
    await this.notificationEventEngine.notifyDriverBooked({
      deliveryId: input.deliveryId,
      driverId: input.driverId,
      actorUserId: input.bookedByUserId ?? null,
    });
    this.emitStatusChanged(input.deliveryId, "BOOKED");

    return booking;
  });
}

async startTrip(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}) {
  return this.prisma.$transaction(async (tx) => {
    const delivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        trackingShareToken: true,
        trackingShareExpiresAt: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    if (delivery.status !== EnumDeliveryRequestStatus.BOOKED) {
      throw new ConflictException("Only BOOKED deliveries can be started");
    }

    // Payment gate: for PREPAID deliveries, payment must be AUTHORIZED or CAPTURED
    // before the driver can start the trip.
    const payment = await tx.payment.findUnique({
      where: { deliveryId: input.deliveryId },
      select: { paymentType: true, status: true },
    });

    if (payment && payment.paymentType === "PREPAID") {
      if (!["AUTHORIZED", "CAPTURED", "PAID", "INVOICED"].includes(payment.status)) {
        throw new ConflictException(
          "Payment must be authorized before the driver can start. " +
          "The customer needs to complete payment on the delivery details page.",
        );
      }
    }

    await this.assertDriverAssignedToDeliveryTx(tx, input.deliveryId, input.driverId);

    // TODO(TEMPORARY): First-pickup-of-day time lock — commented out for testing.
    // Re-enable when ready to enforce scheduled pickup windows.
    //
    // const deliveryWithWindow = await tx.deliveryRequest.findUnique({
    //   where: { id: input.deliveryId },
    //   select: { pickupWindowStart: true },
    // });
    //
    // if (deliveryWithWindow?.pickupWindowStart) {
    //   const todayStart = businessStartOfDay();
    //
    //   const completedToday = await tx.deliveryAssignment.findFirst({
    //     where: {
    //       driverId: input.driverId,
    //       unassignedAt: null,
    //       delivery: {
    //         status: EnumDeliveryRequestStatus.COMPLETED,
    //         updatedAt: { gte: todayStart },
    //       },
    //     },
    //     select: { id: true },
    //   });
    //
    //   const nowBusiness = businessNow();
    //   const windowStartBusiness = toBusinessDateTime(deliveryWithWindow.pickupWindowStart);
    //
    //   this.logger.debug(
    //     `Pickup window check: now=${nowBusiness.toISO()} windowStart=${windowStartBusiness.toISO()} ` +
    //     `completedToday=${!!completedToday} now < windowStart=${nowBusiness < windowStartBusiness}`
    //   );
    //
    //   if (!completedToday && nowBusiness < windowStartBusiness) {
    //     this.logger.warn(
    //       `BLOCKED trip start: deliveryId=${input.deliveryId} driverId=${input.driverId} ` +
    //       `now=${nowBusiness.toISO()} windowStart=${windowStartBusiness.toISO()} ` +
    //       `completedToday=${!!completedToday} windowDate=${windowStartBusiness.toFormat('yyyy-MM-dd')} today=${nowBusiness.toFormat('yyyy-MM-dd')}`
    //     );
    //     throw new ConflictException(
    //       `First pickup of the day must wait until the scheduled time. ` +
    //       `You can start at ${windowStartBusiness.toFormat('MMM d, h:mm a')} (${BUSINESS_TZ}). Current time: ${nowBusiness.toFormat('MMM d, h:mm a')}.`
    //     );
    //   }
    // }

    // Guard: only one delivery can be ACTIVE at a time.
    // If the driver already has an ACTIVE delivery, reject the start.
    const existingActive = await tx.deliveryAssignment.findFirst({
      where: {
        driverId: input.driverId,
        unassignedAt: null,
        delivery: {
          status: EnumDeliveryRequestStatus.ACTIVE,
          id: { not: input.deliveryId },
        },
      },
      select: { id: true },
    });

    if (existingActive) {
      throw new ConflictException("You already have a delivery in progress — complete it before starting another");
    }

    await this.deliveryComplianceEngine.assertReadyForTripStart(
      input.deliveryId,
      input.driverId,
      tx
    );

    // Clear any stale tracking points from a previous attempt
    const existingSession = await tx.trackingSession.findUnique({
      where: { deliveryId: input.deliveryId },
      select: { id: true },
    });
    if (existingSession) {
      await tx.trackingPoint.deleteMany({
        where: { sessionId: existingSession.id },
      });
    }

    await tx.trackingSession.upsert({
      where: { deliveryId: input.deliveryId },
      create: {
        deliveryId: input.deliveryId,
        startedAt: businessNow().toJSDate(),
        stoppedAt: null,
        status: EnumTrackingSessionStatus.STARTED,
        drivenMiles: 0,
      },
      update: {
        startedAt: businessNow().toJSDate(),
        stoppedAt: null,
        status: EnumTrackingSessionStatus.STARTED,
        drivenMiles: 0,
      },
    });

    // Always generate a fresh token and 24h expiration at trip start
    // so the tracking link sent in the email is guaranteed valid.
    const trackingShareToken = this.generateTrackingToken();
    const trackingShareExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await tx.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.ACTIVE,
        trackingShareToken,
        trackingShareExpiresAt,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        note: "Trip started",
        fromStatus: EnumDeliveryStatusHistoryFromStatus.BOOKED,
        toStatus: EnumDeliveryStatusHistoryToStatus.ACTIVE,
      },
    });

    return {
      ok: true,
      trackingShareToken,
      trackingShareExpiresAt,
    };
}).then(async (result) => {
  await this.notificationEventEngine.notifyTripStarted({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    trackingUrl: this.buildPublicTrackingUrl(result.trackingShareToken),
    expiresAt: result.trackingShareExpiresAt,
  });
  this.emitStatusChanged(input.deliveryId, "ACTIVE");

  return result;
});
}

async completeTrip(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
}) {
  return this.prisma.$transaction(async (tx) => {
    const delivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        dropoffLat: true,
        dropoffLng: true,
        quoteId: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    if (delivery.status !== EnumDeliveryRequestStatus.ACTIVE) {
      throw new ConflictException("Only ACTIVE deliveries can be completed");
    }

    await this.assertDriverAssignedToDeliveryTx(tx, input.deliveryId, input.driverId);

    await this.deliveryComplianceEngine.assertReadyForTripCompletion(
      input.deliveryId,
      input.driverId,
      tx
    );

    const tracking = await tx.trackingSession.findUnique({
      where: { deliveryId: input.deliveryId },
      select: {
        id: true,
        drivenMiles: true,
        points: {
          select: {
            lat: true,
            lng: true,
          },
        },
      },
    });

    const pointCount = tracking?.points?.length ?? 0;

    // Require minimum tracking points to prevent completions without any GPS data.
    // For very short trips (under 2 miles), allow as few as 1 point.
    // For normal trips, require at least 3 points to confirm actual movement occurred.
    if (pointCount < 1) {
      throw new BadRequestException(
        "Cannot complete delivery: no GPS tracking data recorded. Location must be on during the trip."
      );
    }

    let drivenMiles = tracking?.drivenMiles ?? 0;

    // For trips with a meaningful distance (2+ miles driven), require at least 3 tracking points
    if (drivenMiles >= 2 && pointCount < 3) {
      throw new BadRequestException(
        `Cannot complete delivery: insufficient tracking data (${pointCount} points). At least 3 GPS points are required for trips over 2 miles. Please ensure location is on.`
      );
    }

    // Geofence check disabled temporarily for testing the full flow.
    // const lastPoint = tracking?.points?.[pointCount - 1];
    // if (lastPoint && delivery.dropoffLat != null && delivery.dropoffLng != null) {
    //   const distanceFromDropoff = this.haversineMiles(
    //     lastPoint.lat,
    //     lastPoint.lng,
    //     delivery.dropoffLat,
    //     delivery.dropoffLng
    //   );
    //   const MAX_GEOFENCE_RADIUS_MILES = 0.5;
    //   if (distanceFromDropoff > MAX_GEOFENCE_RADIUS_MILES) {
    //     throw new BadRequestException(
    //       `You appear to be ${distanceFromDropoff.toFixed(1)} miles away from the dropoff location. Please proceed to the dropoff address before completing the delivery.`
    //     );
    //   }
    // }

    // If GPS-driven miles is 0 or too low, fall back to the quote map distance.
    // This prevents completed deliveries from showing 0 miles when GPS signal was poor.
    let finalDrivenMiles = drivenMiles;
    if (finalDrivenMiles <= 0 && delivery.quoteId) {
      const quote = await tx.quote.findUnique({
        where: { id: delivery.quoteId },
        select: { distanceMiles: true },
      });
      if (quote?.distanceMiles != null && quote.distanceMiles > 0) {
        finalDrivenMiles = quote.distanceMiles;
      }
    }

    // Ensure tracking session exists and is properly stopped.
    // If session is missing (e.g. admin override path), create a STOPPED one.
    if (tracking) {
      await tx.trackingSession.updateMany({
        where: { deliveryId: input.deliveryId },
        data: {
          stoppedAt: businessNow().toJSDate(),
          status: EnumTrackingSessionStatus.STOPPED,
          drivenMiles: finalDrivenMiles,
        },
      });
    } else {
      await tx.trackingSession.create({
        data: {
          deliveryId: input.deliveryId,
          status: EnumTrackingSessionStatus.STOPPED,
          startedAt: businessNow().toJSDate(),
          stoppedAt: businessNow().toJSDate(),
          drivenMiles: finalDrivenMiles,
        },
      });
    }

    await tx.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.COMPLETED,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        note: "Trip completed",
        fromStatus: EnumDeliveryStatusHistoryFromStatus.ACTIVE,
        toStatus: EnumDeliveryStatusHistoryToStatus.COMPLETED,
      },
    });

    await this.paymentPayoutEngine.handleCompletionTx(tx, {
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
    });

    return {
      ok: true,
      trackingPointCount: tracking?.points?.length ?? 0,
    };
  }).then(async (result) => {
    await this.notificationEventEngine.notifyTripCompleted({
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
    });
    this.emitStatusChanged(input.deliveryId, "COMPLETED");

    return result;
  });
}

  /**
   * Close a delivery — used when a dealer/customer ends a delivery
   * without the driver going through the normal dropoff compliance
   * flow. The delivery is marked CLOSED (not COMPLETED).
   * Can be called from BOOKED or ACTIVE status.
   */
  async closeDelivery(input: {
    deliveryId: string;
    actorUserId?: string | null;
    actorRole?: EnumDeliveryStatusHistoryActorRole | null;
    reason?: string | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: input.deliveryId },
        select: { id: true, status: true },
      });

      if (!delivery) {
        throw new NotFoundException("Delivery request not found");
      }

      if (
        delivery.status !== EnumDeliveryRequestStatus.BOOKED &&
        delivery.status !== EnumDeliveryRequestStatus.ACTIVE
      ) {
        throw new BadRequestException(
          `Only BOOKED or ACTIVE deliveries can be closed. Current status: ${delivery.status}`
        );
      }

      // Stop tracking session if one is active
      if (delivery.status === EnumDeliveryRequestStatus.ACTIVE) {
        await tx.trackingSession.updateMany({
          where: { deliveryId: input.deliveryId },
          data: {
            stoppedAt: businessNow().toJSDate(),
            status: EnumTrackingSessionStatus.STOPPED,
          },
        });
      }

      await tx.deliveryRequest.update({
        where: { id: input.deliveryId },
        data: { status: EnumDeliveryRequestStatus.CLOSED },
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: input.deliveryId,
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          note: input.reason ?? "Delivery closed by customer",
          fromStatus: delivery.status as any,
          toStatus: EnumDeliveryStatusHistoryToStatus.CLOSED,
        },
      });

      return { ok: true, deliveryId: input.deliveryId };
    }).then(async (result) => {
      this.emitStatusChanged(input.deliveryId, "CLOSED");
      return result;
    });
  }

  // ── GPS Proximity Check for "Start Pickup Now" ──
  // Verifies the driver is physically near the pickup location.
  // Returns { withinRadius, distanceMeters } so the frontend can
  // conditionally show the "Start Pickup Now" button.
  async checkPickupProximity(input: {
    deliveryId: string;
    driverLat: number;
    driverLng: number;
  }): Promise<{ withinRadius: boolean; distanceMeters: number }> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
        status: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.pickupLat == null || delivery.pickupLng == null) {
      throw new BadRequestException("Delivery has no pickup coordinates");
    }

    // 300 meters (~1000 ft) threshold — driver must be at or very near the lot
    const PROXIMITY_RADIUS_METERS = 300;

    const distanceMeters = this.haversineMeters(
      input.driverLat,
      input.driverLng,
      delivery.pickupLat,
      delivery.pickupLng,
    );

    return {
      withinRadius: distanceMeters <= PROXIMITY_RADIUS_METERS,
      distanceMeters: Math.round(distanceMeters),
    };
  }

  /** Haversine distance in meters between two lat/lng points */
  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Lightweight read-only lookup: which delivery is this driver currently active on?
   * Used by the WebSocket gateway to emit location updates BEFORE the DB write.
   * No writes, no transaction — just 2 fast queries.
   */
  async getActiveDeliveryForDriver(userId: string): Promise<{
    deliveryId: string | null;
    shareToken: string | null;
    sessionStarted: boolean;
  }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) return { deliveryId: null, shareToken: null, sessionStarted: false };

    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        driverId: driver.id,
        unassignedAt: null,
        delivery: { status: EnumDeliveryRequestStatus.ACTIVE },
      },
      orderBy: { assignedAt: "desc" },
      select: {
        deliveryId: true,
        delivery: {
          select: {
            trackingShareToken: true,
            trackingSession: {
              select: { status: true },
            },
          },
        },
      },
    });

    const session = assignment?.delivery?.trackingSession;
    return {
      deliveryId: assignment?.deliveryId ?? null,
      shareToken: assignment?.delivery?.trackingShareToken ?? null,
      sessionStarted: session?.status === EnumTrackingSessionStatus.STARTED,
    };
  }

  async ingestDriverLocation(input: {
    userId: string;
    lat: number;
    lng: number;
    recordedAt?: Date;
    useLiveLocation?: boolean;
  }) {
    this.assertValidCoordinates(input.lat, input.lng);

    const recordedAt = input.recordedAt ?? businessNow().toJSDate();

    return this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { userId: input.userId },
        select: {
          id: true,
          userId: true,
          status: true,
        },
      });

      if (!driver) {
        throw new NotFoundException("Driver profile not found");
      }

      await tx.driverLocation.upsert({
        where: { driverId: driver.id },
        create: {
          driverId: driver.id,
          currentLat: input.lat,
          currentLng: input.lng,
          currentAt: recordedAt,
          useLiveLocation: input.useLiveLocation === true,
        },
        update: {
          currentLat: input.lat,
          currentLng: input.lng,
          currentAt: recordedAt,
          useLiveLocation: input.useLiveLocation === true,
        },
      });

      const activeAssignment = await tx.deliveryAssignment.findFirst({
        where: {
          driverId: driver.id,
          unassignedAt: null,
          delivery: {
            status: EnumDeliveryRequestStatus.ACTIVE,
          },
        },
        orderBy: {
          assignedAt: "desc",
        },
        select: {
          deliveryId: true,
          delivery: {
            select: {
              id: true,
              status: true,
              trackingShareToken: true,
              trackingSession: {
                select: {
                  id: true,
                  status: true,
                  drivenMiles: true,
                  points: {
                    orderBy: { recordedAt: "desc" },
                    take: 1,
                    select: {
                      lat: true,
                      lng: true,
                      recordedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let trackingPointCreated = false;
      let trackingSessionId: string | null = null;
      let drivenMiles: number | null = null;

      // Ensure tracking session exists and is STARTED for this active delivery.
      // If missing (e.g. admin set status directly, or race condition), auto-create it.
      if (activeAssignment?.deliveryId) {
        const existingSession = activeAssignment.delivery?.trackingSession;
        let sessionId: string;

        if (!existingSession) {
          const created = await tx.trackingSession.create({
            data: {
              deliveryId: activeAssignment.deliveryId,
              status: EnumTrackingSessionStatus.STARTED,
              startedAt: recordedAt,
              drivenMiles: 0,
            },
          });
          sessionId = created.id;
          this.logger.log(`Auto-created TrackingSession ${sessionId} for delivery ${activeAssignment.deliveryId}`);
        } else if (existingSession.status !== EnumTrackingSessionStatus.STARTED) {
          await tx.trackingSession.update({
            where: { id: existingSession.id },
            data: {
              status: EnumTrackingSessionStatus.STARTED,
              startedAt: recordedAt,
              stoppedAt: null,
              drivenMiles: 0,
            },
          });
          sessionId = existingSession.id;
          this.logger.log(`Re-started TrackingSession ${sessionId} for delivery ${activeAssignment.deliveryId}`);
        } else {
          sessionId = existingSession.id;
        }

        const previousPoint = existingSession?.points?.[0] ?? null;

        await tx.trackingPoint.create({
          data: {
            sessionId,
            lat: input.lat,
            lng: input.lng,
            recordedAt,
          },
        });

        let totalMiles = Number(existingSession?.drivenMiles ?? 0);

        if (previousPoint) {
          const segmentMiles = this.haversineMiles(
            previousPoint.lat,
            previousPoint.lng,
            input.lat,
            input.lng
          );

          if (segmentMiles >= 0.01 && segmentMiles <= 50) {
            totalMiles += segmentMiles;
          }
        }

        await tx.trackingSession.update({
          where: { id: sessionId },
          data: {
            drivenMiles: totalMiles,
          },
        });

        trackingPointCreated = true;
        trackingSessionId = sessionId;
        drivenMiles = totalMiles;
      }

      return {
        ok: true,
        driverId: driver.id,
        recordedAt,
        tracking: {
          activeDeliveryId: activeAssignment?.deliveryId ?? null,
          trackingSessionId,
          trackingPointCreated,
          drivenMiles,
          shareToken: activeAssignment?.delivery?.trackingShareToken ?? null,
        },
      };
    });
  }

  /**
   * Re-implementation that wraps the DB transaction and emits socket events.
   * The original ingestDriverLocation above is preserved for rollback safety.
   */
  async ingestDriverLocationWithSocket(input: {
    userId: string;
    lat: number;
    lng: number;
    recordedAt?: Date;
    useLiveLocation?: boolean;
  }) {
    this.assertValidCoordinates(input.lat, input.lng);

    const recordedAt = input.recordedAt ?? businessNow().toJSDate();

    const result = await this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({
        where: { userId: input.userId },
        select: { id: true, userId: true, status: true },
      });
      if (!driver) throw new NotFoundException("Driver profile not found");

      await tx.driverLocation.upsert({
        where: { driverId: driver.id },
        create: { driverId: driver.id, currentLat: input.lat, currentLng: input.lng, currentAt: recordedAt, useLiveLocation: input.useLiveLocation === true },
        update: { currentLat: input.lat, currentLng: input.lng, currentAt: recordedAt, useLiveLocation: input.useLiveLocation === true },
      });

      const activeAssignment = await tx.deliveryAssignment.findFirst({
        where: { driverId: driver.id, unassignedAt: null, delivery: { status: EnumDeliveryRequestStatus.ACTIVE } },
        orderBy: { assignedAt: "desc" },
        select: {
          deliveryId: true,
          delivery: {
            select: {
              id: true, status: true, trackingShareToken: true,
              trackingSession: {
                select: { id: true, status: true, drivenMiles: true, points: { orderBy: { recordedAt: "desc" }, take: 1, select: { lat: true, lng: true, recordedAt: true } } },
              },
            },
          },
        },
      });

      let trackingPointCreated = false;
      let trackingSessionId: string | null = null;
      let drivenMiles: number | null = null;

      // Ensure tracking session exists and is STARTED for this active delivery.
      if (activeAssignment?.deliveryId) {
        const existingSession = activeAssignment.delivery?.trackingSession;
        let sessionId: string;

        if (!existingSession) {
          const created = await tx.trackingSession.create({
            data: {
              deliveryId: activeAssignment.deliveryId,
              status: EnumTrackingSessionStatus.STARTED,
              startedAt: recordedAt,
              drivenMiles: 0,
            },
          });
          sessionId = created.id;
        } else if (existingSession.status !== EnumTrackingSessionStatus.STARTED) {
          await tx.trackingSession.update({
            where: { id: existingSession.id },
            data: {
              status: EnumTrackingSessionStatus.STARTED,
              startedAt: recordedAt,
              stoppedAt: null,
              drivenMiles: 0,
            },
          });
          sessionId = existingSession.id;
        } else {
          sessionId = existingSession.id;
        }

        const previousPoint = existingSession?.points?.[0] ?? null;

        await tx.trackingPoint.create({
          data: { sessionId, lat: input.lat, lng: input.lng, recordedAt },
        });

        let totalMiles = Number(existingSession?.drivenMiles ?? 0);
        if (previousPoint) {
          const segmentMiles = this.haversineMiles(previousPoint.lat, previousPoint.lng, input.lat, input.lng);
          if (segmentMiles >= 0.01 && segmentMiles <= 50) totalMiles += segmentMiles;
        }

        await tx.trackingSession.update({ where: { id: sessionId }, data: { drivenMiles: totalMiles } });

        trackingPointCreated = true;
        trackingSessionId = sessionId;
        drivenMiles = totalMiles;
      }

      return {
        ok: true, driverId: driver.id, recordedAt,
        tracking: {
          activeDeliveryId: activeAssignment?.deliveryId ?? null,
          trackingSessionId, trackingPointCreated, drivenMiles,
          shareToken: activeAssignment?.delivery?.trackingShareToken ?? null,
        },
      };
    });

    // ── SOCKET.IO EMIT (after successful DB write) ──
    // Broadcast whenever driver has an active delivery — do NOT gate on trackingPointCreated
    // so that real-time updates work even if TrackingSession is missing or not STARTED.
    if (this.trackingGateway && result.tracking.activeDeliveryId) {
      try {
        this.trackingGateway.emitLocationUpdate({
          deliveryId: result.tracking.activeDeliveryId,
          lat: input.lat,
          lng: input.lng,
          recordedAt: result.recordedAt.toISOString(),
          drivenMiles: result.tracking.drivenMiles,
          shareToken: result.tracking.shareToken ?? undefined,
        });
      } catch (err) {
        this.logger.warn("Failed to emit location update via WebSocket:", err);
      }
    }

    return result;
  }

async createTrackingLink(input: {
  deliveryId: string;
  expiresInHours?: number;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      recipientEmail: true,
      recipientPhone: true,
    },
  });

  if (!delivery) {
    throw new NotFoundException("Delivery request not found");
  }

  const expiresInHours = Math.max(1, Math.min(168, input.expiresInHours ?? 24));
  const token = this.generateTrackingToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await this.prisma.deliveryRequest.update({
    where: { id: input.deliveryId },
    data: {
      trackingShareToken: token,
      trackingShareExpiresAt: expiresAt,
    },
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    trackingUrl: this.buildPublicTrackingUrl(token),
  };
}

async getTrackingLink(input: {
  deliveryId: string;
}) {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      trackingShareToken: true,
      trackingShareExpiresAt: true,
    },
  });

  if (!delivery) {
    throw new NotFoundException("Delivery request not found");
  }

  if (!delivery.trackingShareToken || !delivery.trackingShareExpiresAt) {
    const token = this.generateTrackingToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        trackingShareToken: token,
        trackingShareExpiresAt: expiresAt,
      },
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      trackingUrl: this.buildPublicTrackingUrl(token),
    };
  }

  return {
    token: delivery.trackingShareToken,
    expiresAt: delivery.trackingShareExpiresAt?.toISOString() ?? null,
    trackingUrl: this.buildPublicTrackingUrl(delivery.trackingShareToken),
  };
}

  async getPublicTracking(input: {
    token: string;
  }) {
    const delivery = await this.prisma.deliveryRequest.findFirst({
      where: {
        trackingShareToken: input.token,
      },
      select: {
        id: true,
        status: true,
        serviceType: true,
        pickupPin: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        trackingShareExpiresAt: true,
        trackingSession: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            stoppedAt: true,
            drivenMiles: true,
            points: {
              orderBy: { recordedAt: "asc" },
              select: {
                lat: true,
                lng: true,
                recordedAt: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Tracking link not found");
    }

    // Tracking only matters when there's a driver actively on the road.
    // ACTIVE: always allow — driver is moving, never expire mid-trip.
    // Everything else (COMPLETED, CANCELLED, DRAFT, etc.): no live driver to follow.
    if (delivery.status !== EnumDeliveryRequestStatus.ACTIVE) {
      throw new ConflictException("Tracking is not available for this delivery status");
    }

    const points = delivery.trackingSession?.points ?? [];
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;

    return {
      deliveryId: delivery.id,
      status: delivery.status,
      serviceType: delivery.serviceType,
      pickupPin: delivery.pickupPin,
      expiresAt: delivery.trackingShareExpiresAt?.toISOString() ?? null,
      pickup: {
        address: delivery.pickupAddress,
        lat: delivery.pickupLat,
        lng: delivery.pickupLng,
      },
      dropoff: {
        address: delivery.dropoffAddress,
        lat: delivery.dropoffLat,
        lng: delivery.dropoffLng,
      },
      trackingSession: delivery.trackingSession
        ? {
            id: delivery.trackingSession.id,
            status: delivery.trackingSession.status,
            startedAt: delivery.trackingSession.startedAt,
            stoppedAt: delivery.trackingSession.stoppedAt,
            drivenMiles: delivery.trackingSession.drivenMiles ?? 0,
            latestPoint,
            points,
          }
        : null,
    };
  }

  private async assertDriverAssignedToDeliveryTx(
    tx: Tx,
    deliveryId: string,
    driverId: string
  ) {
    const assignment = await tx.deliveryAssignment.findFirst({
      where: {
        deliveryId,
        driverId,
        unassignedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      throw new ConflictException("Driver is not assigned to this delivery");
    }
  }

  private assertTransitionAllowed(
    fromStatus: EnumDeliveryRequestStatus,
    toStatus: EnumDeliveryRequestStatus
  ) {
    const allowed = this.allowedTransitions[fromStatus] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ConflictException(
        `Invalid delivery status transition: ${fromStatus} -> ${toStatus}`
      );
    }
  }

  private async assertTransitionGuards(
    tx: Tx,
    deliveryId: string,
    fromStatus: EnumDeliveryRequestStatus,
    toStatus: EnumDeliveryRequestStatus
  ) {
    if (
      fromStatus === EnumDeliveryRequestStatus.QUOTED &&
      toStatus === EnumDeliveryRequestStatus.LISTED
    ) {
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: deliveryId },
        select: {
          quoteId: true,
          pickupWindowStart: true,
          pickupWindowEnd: true,
          dropoffWindowStart: true,
          dropoffWindowEnd: true,
        },
      });

      if (!delivery?.quoteId) {
        throw new BadRequestException("LISTED delivery must have an accepted quote");
      }

      if (!delivery.pickupWindowStart || !delivery.pickupWindowEnd) {
        throw new BadRequestException("Pickup window is required before listing");
      }

      if (!delivery.dropoffWindowStart || !delivery.dropoffWindowEnd) {
        throw new BadRequestException("Drop-off window is required before listing");
      }
    }
  }

  private assertValidCoordinates(lat: number, lng: number) {
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException("Invalid latitude");
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException("Invalid longitude");
    }
  }

  private generateTrackingToken(): string {
    return randomBytes(24).toString("hex");
  }

  /**
   * Generate a random 4-digit PIN for pickup authorization.
   * Always returns exactly 4 numeric digits (1000-9999).
   */
  generatePickupPin(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  /**
   * Verify a 4-digit PIN against the delivery's pickupPin.
   * Returns true if it matches, false otherwise.
   */
  async verifyPickupPin(input: {
    deliveryId: string;
    pin: string;
  }): Promise<{ valid: boolean }> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: { id: true, pickupPin: true },
    });
    if (!delivery || !delivery.pickupPin) {
      return { valid: false };
    }
    return { valid: delivery.pickupPin === input.pin };
  }

  private haversineMiles(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 3958.7613;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

private buildPublicTrackingUrl(token: string): string {
  return `${this.appDomain}/track/${token}`;
}
}
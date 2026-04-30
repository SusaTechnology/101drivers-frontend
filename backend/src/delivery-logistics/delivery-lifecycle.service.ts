import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
import { DriverJobFeedService } from "./driver-job-feed.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { DeliveryComplianceEngine } from "../domain/deliveryCompliance/deliveryCompliance.engine";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";

type Tx = Prisma.TransactionClient;

type StatusActor = {
  actorUserId?: string | null;
  actorRole?: EnumDeliveryStatusHistoryActorRole | null;
  actorType?: EnumDeliveryStatusHistoryActorType;
  note?: string | null;
};

@Injectable()
export class DeliveryLifecycleService {
  private readonly appDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverJobFeedService: DriverJobFeedService,
    private readonly notificationEventEngine: NotificationEventEngine,
    private readonly deliveryComplianceEngine: DeliveryComplianceEngine,
    private readonly paymentPayoutEngine: PaymentPayoutEngine,
    private readonly configService: ConfigService
  ) {
    this.appDomain = this.normalizeBaseUrl(
      this.configService.get<string>("101_DOMAIN") ??
        "https://101drivers.techbee.et"
    );
  }

  private normalizeBaseUrl(url: string): string {
    return (url || "").trim().replace(/\/+$/, "");
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
      EnumDeliveryRequestStatus.CANCELLED,
      EnumDeliveryRequestStatus.DISPUTED,
      EnumDeliveryRequestStatus.LISTED,
    ],
    [EnumDeliveryRequestStatus.ACTIVE]: [
      EnumDeliveryRequestStatus.COMPLETED,
      EnumDeliveryRequestStatus.DISPUTED,
      EnumDeliveryRequestStatus.CANCELLED,
    ],
    [EnumDeliveryRequestStatus.COMPLETED]: [
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
    });
  }

async bookDelivery(input: {
  deliveryId: string;
  driverId: string;
  bookedByUserId?: string | null;
  reason?: string | null;
}) {
  return this.prisma.$transaction(async (tx) => {
    await this.driverJobFeedService.assertDriverCanBookDelivery(tx, {
      driverId: input.driverId,
      deliveryId: input.deliveryId,
    });

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

    await this.assertDriverAssignedToDeliveryTx(tx, input.deliveryId, input.driverId);

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
        startedAt: new Date(),
        stoppedAt: null,
        status: EnumTrackingSessionStatus.STARTED,
        drivenMiles: 0,
      },
      update: {
        startedAt: new Date(),
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
          stoppedAt: new Date(),
          status: EnumTrackingSessionStatus.STOPPED,
          drivenMiles: finalDrivenMiles,
        },
      });
    } else {
      await tx.trackingSession.create({
        data: {
          deliveryId: input.deliveryId,
          status: EnumTrackingSessionStatus.STOPPED,
          startedAt: new Date(),
          stoppedAt: new Date(),
          drivenMiles: finalDrivenMiles,
        },
      });
    }

    await tx.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.COMPLETED,
        trackingShareExpiresAt: new Date(),
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

    return result;
  });
}

  async ingestDriverLocation(input: {
    userId: string;
    lat: number;
    lng: number;
    recordedAt?: Date;
  }) {
    this.assertValidCoordinates(input.lat, input.lng);

    const recordedAt = input.recordedAt ?? new Date();

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
        },
        update: {
          currentLat: input.lat,
          currentLng: input.lng,
          currentAt: recordedAt,
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

      if (
        activeAssignment?.delivery?.trackingSession &&
        activeAssignment.delivery.trackingSession.status ===
          EnumTrackingSessionStatus.STARTED
      ) {
        const session = activeAssignment.delivery.trackingSession;
        const previousPoint = session.points?.[0] ?? null;

        await tx.trackingPoint.create({
          data: {
            sessionId: session.id,
            lat: input.lat,
            lng: input.lng,
            recordedAt,
          },
        });

        let totalMiles = Number(session.drivenMiles ?? 0);

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
          where: { id: session.id },
          data: {
            drivenMiles: totalMiles,
          },
        });

        trackingPointCreated = true;
        trackingSessionId = session.id;
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
        },
      };
    });
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
    expiresAt: delivery.trackingShareExpiresAt.toISOString(),
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

    if (
      !delivery.trackingShareExpiresAt ||
      delivery.trackingShareExpiresAt.getTime() < Date.now()
    ) {
      throw new ConflictException("Tracking link expired");
    }

    const points = delivery.trackingSession?.points ?? [];
    const latestPoint = points.length > 0 ? points[points.length - 1] : null;

    return {
      deliveryId: delivery.id,
      status: delivery.status,
      serviceType: delivery.serviceType,
      expiresAt: delivery.trackingShareExpiresAt.toISOString(),
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
// src/domain/trackingSession/trackingSession.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type TrackingSessionSelect = Prisma.TrackingSessionSelect;
type TrackingSessionWhere = Prisma.TrackingSessionWhereInput;
type TrackingSessionWhereUnique = Prisma.TrackingSessionWhereUniqueInput;
type TrackingSessionFindMany = Prisma.TrackingSessionFindManyArgs;
type TrackingSessionFindUnique = Prisma.TrackingSessionFindUniqueArgs;

@Injectable()
export class TrackingSessionDomain extends BaseDomain<
  TrackingSessionSelect,
  TrackingSessionWhere,
  TrackingSessionWhereUnique,
  TrackingSessionFindMany,
  TrackingSessionFindUnique
> {
  protected enrichSelectFields: TrackingSessionSelect = {
    id: true,
    deliveryId: true,
    status: true,
    startedAt: true,
    stoppedAt: true,
    drivenMiles: true,
    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        trackingShareToken: true,
        trackingShareExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    points: {
      select: {
        id: true,
        lat: true,
        lng: true,
        recordedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        recordedAt: "asc",
      },
    },

    _count: {
      select: {
        points: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.trackingSession);
  }
}
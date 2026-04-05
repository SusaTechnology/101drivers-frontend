// src/domain/trackingPoint/trackingPoint.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type TrackingPointSelect = Prisma.TrackingPointSelect;
type TrackingPointWhere = Prisma.TrackingPointWhereInput;
type TrackingPointWhereUnique = Prisma.TrackingPointWhereUniqueInput;
type TrackingPointFindMany = Prisma.TrackingPointFindManyArgs;
type TrackingPointFindUnique = Prisma.TrackingPointFindUniqueArgs;

@Injectable()
export class TrackingPointDomain extends BaseDomain<
  TrackingPointSelect,
  TrackingPointWhere,
  TrackingPointWhereUnique,
  TrackingPointFindMany,
  TrackingPointFindUnique
> {
  protected enrichSelectFields: TrackingPointSelect = {
    id: true,
    sessionId: true,
    lat: true,
    lng: true,
    recordedAt: true,
    createdAt: true,
    updatedAt: true,

    session: {
      select: {
        id: true,
        deliveryId: true,
        status: true,
        startedAt: true,
        stoppedAt: true,
        drivenMiles: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.trackingPoint);
  }
}
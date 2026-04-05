// src/trackingPoint/trackingPoint.service.ts

import { Injectable } from "@nestjs/common";
import {
  Prisma,
  TrackingPoint as PrismaTrackingPoint,
  TrackingSession as PrismaTrackingSession,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TrackingPointServiceBase } from "./base/trackingPoint.service.base";
import { TrackingPointDomain } from "../domain/trackingPoint/trackingPoint.domain";
import { TrackingPointPolicyService } from "../domain/trackingPoint/trackingPointPolicy.service";

@Injectable()
export class TrackingPointService extends TrackingPointServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: TrackingPointDomain,
    private readonly policy: TrackingPointPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.TrackingPointCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.trackingPoint.count(args);
  }

  async trackingPoints(args: Prisma.TrackingPointFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async trackingPoint(args: Prisma.TrackingPointFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createTrackingPoint(args: Prisma.TrackingPointCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.trackingPoint.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateTrackingPoint(args: Prisma.TrackingPointUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.trackingPoint.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteTrackingPoint(
    args: Prisma.TrackingPointDeleteArgs
  ): Promise<PrismaTrackingPoint> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.trackingPoint.delete(args);
  }

  async getSession(parentId: string): Promise<PrismaTrackingSession | null> {
    return this.prisma.trackingPoint
      .findUnique({ where: { id: parentId } })
      .session();
  }

  private normalizeCreateData(
    data: Prisma.TrackingPointCreateArgs["data"]
  ): Prisma.TrackingPointCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.TrackingPointUpdateArgs["data"]
  ): Prisma.TrackingPointUpdateArgs["data"] {
    return { ...data };
  }
}
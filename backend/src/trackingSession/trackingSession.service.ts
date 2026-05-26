// src/trackingSession/trackingSession.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  Prisma,
  TrackingPoint as PrismaTrackingPoint,
  TrackingSession as PrismaTrackingSession,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TrackingSessionServiceBase } from "./base/trackingSession.service.base";
import { TrackingSessionDomain } from "../domain/trackingSession/trackingSession.domain";
import { TrackingSessionPolicyService } from "../domain/trackingSession/trackingSessionPolicy.service";

@Injectable()
export class TrackingSessionService extends TrackingSessionServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: TrackingSessionDomain,
    private readonly policy: TrackingSessionPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.TrackingSessionCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.trackingSession.count(args);
  }

  async trackingSessions(args: Prisma.TrackingSessionFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async trackingSession(args: Prisma.TrackingSessionFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createTrackingSession(args: Prisma.TrackingSessionCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.trackingSession.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateTrackingSession(args: Prisma.TrackingSessionUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.trackingSession.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteTrackingSession(
    args: Prisma.TrackingSessionDeleteArgs
  ): Promise<PrismaTrackingSession> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.trackingSession.delete(args);
  }

  async findPoints(
    parentId: string,
    args: Prisma.TrackingPointFindManyArgs
  ): Promise<PrismaTrackingPoint[]> {
    return this.prisma.trackingSession
      .findUniqueOrThrow({ where: { id: parentId } })
      .points(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.trackingSession
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.TrackingSessionCreateArgs["data"]
  ): Prisma.TrackingSessionCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.TrackingSessionUpdateArgs["data"]
  ): Prisma.TrackingSessionUpdateArgs["data"] {
    return { ...data };
  }
}
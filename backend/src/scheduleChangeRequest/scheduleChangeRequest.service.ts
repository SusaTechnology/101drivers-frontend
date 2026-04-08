// src/scheduleChangeRequest/scheduleChangeRequest.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  Prisma,
  ScheduleChangeRequest as PrismaScheduleChangeRequest,
  User as PrismaUser,
} from "@prisma/client";
import { ScheduleChangeEngine } from "../domain/scheduleChangeRequest/scheduleChange.engine";
import {
  EnumScheduleChangeRequestRequestedByRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ScheduleChangeRequestServiceBase } from "./base/scheduleChangeRequest.service.base";
import { ScheduleChangeRequestDomain } from "../domain/scheduleChangeRequest/scheduleChangeRequest.domain";
import { ScheduleChangeRequestPolicyService } from "../domain/scheduleChangeRequest/scheduleChangeRequestPolicy.service";

@Injectable()
export class ScheduleChangeRequestService extends ScheduleChangeRequestServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: ScheduleChangeRequestDomain,
  private readonly policy: ScheduleChangeRequestPolicyService,
  private readonly engine: ScheduleChangeEngine
) {
  super(prisma);
}

  async count(
    args: Omit<Prisma.ScheduleChangeRequestCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.scheduleChangeRequest.count(args);
  }

  async scheduleChangeRequests(
    args: Prisma.ScheduleChangeRequestFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async scheduleChangeRequest(
    args: Prisma.ScheduleChangeRequestFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createScheduleChangeRequest(
    args: Prisma.ScheduleChangeRequestCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.scheduleChangeRequest.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateScheduleChangeRequest(
    args: Prisma.ScheduleChangeRequestUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.scheduleChangeRequest.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteScheduleChangeRequest(
    args: Prisma.ScheduleChangeRequestDeleteArgs
  ): Promise<PrismaScheduleChangeRequest> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.scheduleChangeRequest.delete(args);
  }

  async getDecidedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.scheduleChangeRequest
      .findUnique({ where: { id: parentId } })
      .decidedBy();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.scheduleChangeRequest
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getRequestedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.scheduleChangeRequest
      .findUnique({ where: { id: parentId } })
      .requestedBy();
  }

  private normalizeCreateData(
    data: Prisma.ScheduleChangeRequestCreateArgs["data"]
  ): Prisma.ScheduleChangeRequestCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.reason = this.trimOptionalString(normalized.reason);
    normalized.decisionNote = this.trimOptionalString(normalized.decisionNote);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.ScheduleChangeRequestUpdateArgs["data"]
  ): Prisma.ScheduleChangeRequestUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "reason");
    this.normalizeUpdateStringField(normalized, "decisionNote");

    return normalized;
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.trimOptionalString(raw.set),
      };
      return;
    }

    target[field] = this.trimOptionalString(raw);
  }
 async requestScheduleChange(input: {
  deliveryId: string;
  requestedByUserId?: string | null;
  requestedByRole?: EnumScheduleChangeRequestRequestedByRole | null;
  proposedPickupWindowStart?: Date | null;
  proposedPickupWindowEnd?: Date | null;
  proposedDropoffWindowStart?: Date | null;
  proposedDropoffWindowEnd?: Date | null;
  reason?: string | null;
}): Promise<any> {
  const created = await this.engine.requestScheduleChange({
    deliveryId: input.deliveryId,
    requestedByUserId: input.requestedByUserId ?? null,
    requestedByRole: input.requestedByRole ?? null,
    proposedPickupWindowStart: input.proposedPickupWindowStart ?? null,
    proposedPickupWindowEnd: input.proposedPickupWindowEnd ?? null,
    proposedDropoffWindowStart: input.proposedDropoffWindowStart ?? null,
    proposedDropoffWindowEnd: input.proposedDropoffWindowEnd ?? null,
    reason: this.trimOptionalString(input.reason) ?? null,
  });

  return this.domain.findUnique({ id: created.id });
}

async approveScheduleChange(input: {
  scheduleChangeRequestId: string;
  decidedByUserId: string;
  decisionNote?: string | null;
}): Promise<any> {
  const updated = await this.engine.approveScheduleChange({
    scheduleChangeRequestId: input.scheduleChangeRequestId,
    decidedByUserId: input.decidedByUserId,
    decisionNote: this.trimOptionalString(input.decisionNote) ?? null,
  });

  return this.domain.findUnique({ id: updated.id });
}

async declineScheduleChange(input: {
  scheduleChangeRequestId: string;
  decidedByUserId: string;
  decisionNote?: string | null;
}): Promise<any> {
  const updated = await this.engine.declineScheduleChange({
    scheduleChangeRequestId: input.scheduleChangeRequestId,
    decidedByUserId: input.decidedByUserId,
    decisionNote: this.trimOptionalString(input.decisionNote) ?? null,
  });

  return this.domain.findUnique({ id: updated.id });
}

async cancelScheduleChange(input: {
  scheduleChangeRequestId: string;
  actorUserId?: string | null;
  actorRole?: EnumScheduleChangeRequestRequestedByRole | null;
  note?: string | null;
}): Promise<any> {
  const updated = await this.engine.cancelScheduleChange({
    scheduleChangeRequestId: input.scheduleChangeRequestId,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: updated.id });
} 
}
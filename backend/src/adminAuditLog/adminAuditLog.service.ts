// src/adminAuditLog/adminAuditLog.service.ts

import { Injectable } from "@nestjs/common";
import {
  AdminAuditLog as PrismaAdminAuditLog,
  Customer as PrismaCustomer,
  DeliveryRequest as PrismaDeliveryRequest,
  Driver as PrismaDriver,
  Prisma,
  User as PrismaUser,
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { AdminAuditLogServiceBase } from "./base/adminAuditLog.service.base";
import { AdminAuditLogDomain } from "../domain/adminAuditLog/adminAuditLog.domain";
import { AdminAuditLogPolicyService } from "../domain/adminAuditLog/adminAuditLogPolicy.service";
import { AdminAuditLogSearchDto } from "./dto/adminAuditLogSearch.dto";

@Injectable()
export class AdminAuditLogService extends AdminAuditLogServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: AdminAuditLogDomain,
    private readonly policy: AdminAuditLogPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.AdminAuditLogCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.adminAuditLog.count(args);
  }

  async adminAuditLogs(args: Prisma.AdminAuditLogFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async adminAuditLog(args: Prisma.AdminAuditLogFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createAdminAuditLog(args: Prisma.AdminAuditLogCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.adminAuditLog.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateAdminAuditLog(args: Prisma.AdminAuditLogUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.adminAuditLog.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteAdminAuditLog(
    args: Prisma.AdminAuditLogDeleteArgs
  ): Promise<PrismaAdminAuditLog> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.adminAuditLog.delete(args);
  }

  async getActor(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.adminAuditLog
      .findUnique({ where: { id: parentId } })
      .actor();
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.adminAuditLog
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.adminAuditLog
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.adminAuditLog
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  async getUser(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.adminAuditLog
      .findUnique({ where: { id: parentId } })
      .user();
  }

  private normalizeCreateData(
    data: Prisma.AdminAuditLogCreateArgs["data"]
  ): Prisma.AdminAuditLogCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.reason = this.trimOptionalString(normalized.reason);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.AdminAuditLogUpdateArgs["data"]
  ): Prisma.AdminAuditLogUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "reason");

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

async searchAdminAuditLogs(
  input: AdminAuditLogSearchDto
): Promise<any[]> {
  const w = input.where ?? {};

  const validActions = new Set(Object.values(EnumAdminAuditLogAction));
  const validActorTypes = new Set(Object.values(EnumAdminAuditLogActorType));

  const action =
    w.action && validActions.has(w.action as EnumAdminAuditLogAction)
      ? (w.action as EnumAdminAuditLogAction)
      : undefined;

  const actionIn =
    w.actionIn?.filter((v) =>
      validActions.has(v as EnumAdminAuditLogAction)
    ) as EnumAdminAuditLogAction[] | undefined;

  const actorType =
    w.actorType && validActorTypes.has(w.actorType as EnumAdminAuditLogActorType)
      ? (w.actorType as EnumAdminAuditLogActorType)
      : undefined;

  const actorTypeIn =
    w.actorTypeIn?.filter((v) =>
      validActorTypes.has(v as EnumAdminAuditLogActorType)
    ) as EnumAdminAuditLogActorType[] | undefined;

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actionIn?.length ? { action: { in: actionIn } } : {}),

    ...(actorType ? { actorType } : {}),
    ...(actorTypeIn?.length ? { actorType: { in: actorTypeIn } } : {}),

    ...(w.actorUserId ? { actorUserId: w.actorUserId } : {}),
    ...(w.customerId ? { customerId: w.customerId } : {}),
    ...(w.driverId ? { driverId: w.driverId } : {}),
    ...(w.deliveryId ? { deliveryId: w.deliveryId } : {}),
    ...(w.userId ? { userId: w.userId } : {}),

    ...(w.reason ? { reason: w.reason } : {}),
    ...(w.reasonContains
      ? {
          reason: {
            contains: w.reasonContains,
            mode: "insensitive",
          },
        }
      : {}),

    ...((w.createdFrom || w.createdTo)
      ? {
          createdAt: {
            ...(w.createdFrom ? { gte: new Date(w.createdFrom) } : {}),
            ...(w.createdTo ? { lte: new Date(w.createdTo) } : {}),
          },
        }
      : {}),

    ...((w.updatedFrom || w.updatedTo)
      ? {
          updatedAt: {
            ...(w.updatedFrom ? { gte: new Date(w.updatedFrom) } : {}),
            ...(w.updatedTo ? { lte: new Date(w.updatedTo) } : {}),
          },
        }
      : {}),
  };

  const allowedSort = new Set([
    "createdAt",
    "updatedAt",
    "action",
    "actorType",
    "reason",
  ]);

  let orderBy: Prisma.AdminAuditLogOrderByWithRelationInput = {
    createdAt: "desc",
  };

  if (input.orderBy) {
    const [key] = Object.keys(input.orderBy);
    if (key && allowedSort.has(key)) {
      orderBy = {
        [key]: input.orderBy[key] === "asc" ? "asc" : "desc",
      };
    }
  }

  return this.domain.findMany({
    where,
    orderBy,
    skip: input.skip,
    take: input.take,
    select: {
      action: true,
      actor: { select: { id: true } },
      actorType: true,
      afterJson: true,
      beforeJson: true,
      createdAt: true,
      customer: { select: { id: true } },
      delivery: { select: { id: true } },
      driver: { select: { id: true } },
      id: true,
      reason: true,
      updatedAt: true,
      user: { select: { id: true } },
    },
  });
}

}
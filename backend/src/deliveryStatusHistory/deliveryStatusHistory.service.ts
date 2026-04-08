// src/deliveryStatusHistory/deliveryStatusHistory.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  DeliveryStatusHistory as PrismaDeliveryStatusHistory,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryStatusHistoryServiceBase } from "./base/deliveryStatusHistory.service.base";
import { DeliveryStatusHistoryDomain } from "../domain/deliveryStatusHistory/deliveryStatusHistory.domain";
import { DeliveryStatusHistoryPolicyService } from "../domain/deliveryStatusHistory/deliveryStatusHistoryPolicy.service";

@Injectable()
export class DeliveryStatusHistoryService extends DeliveryStatusHistoryServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DeliveryStatusHistoryDomain,
    private readonly policy: DeliveryStatusHistoryPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DeliveryStatusHistoryCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryStatusHistory.count(args);
  }

  async deliveryStatusHistories(
    args: Prisma.DeliveryStatusHistoryFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryStatusHistory(
    args: Prisma.DeliveryStatusHistoryFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDeliveryStatusHistory(
    args: Prisma.DeliveryStatusHistoryCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.deliveryStatusHistory.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDeliveryStatusHistory(
    args: Prisma.DeliveryStatusHistoryUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.deliveryStatusHistory.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDeliveryStatusHistory(
    args: Prisma.DeliveryStatusHistoryDeleteArgs
  ): Promise<PrismaDeliveryStatusHistory> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryStatusHistory.delete(args);
  }

  async getActor(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.deliveryStatusHistory
      .findUnique({ where: { id: parentId } })
      .actor();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryStatusHistory
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryStatusHistoryCreateArgs["data"]
  ): Prisma.DeliveryStatusHistoryCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.note = this.trimOptionalString(normalized.note);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryStatusHistoryUpdateArgs["data"]
  ): Prisma.DeliveryStatusHistoryUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "note");

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
}
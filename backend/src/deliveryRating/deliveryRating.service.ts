// src/deliveryRating/deliveryRating.service.ts

import { Injectable } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  DeliveryRating as PrismaDeliveryRating,
  DeliveryRequest as PrismaDeliveryRequest,
  Driver as PrismaDriver,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryRatingServiceBase } from "./base/deliveryRating.service.base";
import { DeliveryRatingDomain } from "../domain/deliveryRating/deliveryRating.domain";
import { DeliveryRatingPolicyService } from "../domain/deliveryRating/deliveryRatingPolicy.service";

@Injectable()
export class DeliveryRatingService extends DeliveryRatingServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DeliveryRatingDomain,
    private readonly policy: DeliveryRatingPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DeliveryRatingCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryRating.count(args);
  }

  async deliveryRatings(args: Prisma.DeliveryRatingFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryRating(args: Prisma.DeliveryRatingFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDeliveryRating(args: Prisma.DeliveryRatingCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.deliveryRating.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDeliveryRating(args: Prisma.DeliveryRatingUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.deliveryRating.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDeliveryRating(
    args: Prisma.DeliveryRatingDeleteArgs
  ): Promise<PrismaDeliveryRating> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryRating.delete(args);
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.deliveryRating
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryRating
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.deliveryRating
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryRatingCreateArgs["data"]
  ): Prisma.DeliveryRatingCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.comment = this.trimOptionalString(normalized.comment);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryRatingUpdateArgs["data"]
  ): Prisma.DeliveryRatingUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "comment");

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
// src/tip/tip.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  Prisma,
  Tip as PrismaTip,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TipServiceBase } from "./base/tip.service.base";
import { TipDomain } from "../domain/tip/tip.domain";
import { TipPolicyService } from "../domain/tip/tipPolicy.service";

@Injectable()
export class TipService extends TipServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: TipDomain,
    private readonly policy: TipPolicyService
  ) {
    super(prisma);
  }

  async count(args: Omit<Prisma.TipCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.tip.count(args);
  }

  async tips(args: Prisma.TipFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async tip(args: Prisma.TipFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createTip(args: Prisma.TipCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.tip.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateTip(args: Prisma.TipUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.tip.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteTip(args: Prisma.TipDeleteArgs): Promise<PrismaTip> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.tip.delete(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.tip
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.TipCreateArgs["data"]
  ): Prisma.TipCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.providerRef = this.trimOptionalString(normalized.providerRef);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.TipUpdateArgs["data"]
  ): Prisma.TipUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "providerRef");

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
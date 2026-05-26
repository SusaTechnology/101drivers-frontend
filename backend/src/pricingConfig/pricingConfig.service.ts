// src/pricingConfig/pricingConfig.service.ts

import { Injectable } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  PricingCategoryRule as PrismaPricingCategoryRule,
  PricingConfig as PrismaPricingConfig,
  PricingTier as PrismaPricingTier,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PricingConfigServiceBase } from "./base/pricingConfig.service.base";
import { PricingConfigDomain } from "../domain/pricingConfig/pricingConfig.domain";
import { PricingConfigPolicyService } from "../domain/pricingConfig/pricingConfigPolicy.service";
import { PricingConfigAdminEngine } from "../domain/pricingConfig/pricingConfigAdmin.engine";
import { SavePricingConfigBody } from "./dto/pricingConfigAdmin.dto";


@Injectable()
export class PricingConfigService extends PricingConfigServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: PricingConfigDomain,
  private readonly policy: PricingConfigPolicyService,
  private readonly pricingConfigAdminEngine: PricingConfigAdminEngine
) {
  super(prisma);
}


  async count(args: Omit<Prisma.PricingConfigCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.pricingConfig.count(args);
  }

  async pricingConfigs(args: Prisma.PricingConfigFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async pricingConfig(args: Prisma.PricingConfigFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPricingConfig(args: Prisma.PricingConfigCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.pricingConfig.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePricingConfig(args: Prisma.PricingConfigUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.pricingConfig.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePricingConfig(args: Prisma.PricingConfigDeleteArgs): Promise<PrismaPricingConfig> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.pricingConfig.delete(args);
  }

  async findCategoryRules(
    parentId: string,
    args: Prisma.PricingCategoryRuleFindManyArgs
  ): Promise<PrismaPricingCategoryRule[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .categoryRules(args);
  }

  async findCustomers(
    parentId: string,
    args: Prisma.CustomerFindManyArgs
  ): Promise<PrismaCustomer[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .customers(args);
  }

  async findTiers(
    parentId: string,
    args: Prisma.PricingTierFindManyArgs
  ): Promise<PrismaPricingTier[]> {
    return this.prisma.pricingConfig
      .findUniqueOrThrow({ where: { id: parentId } })
      .tiers(args);
  }

  private normalizeCreateData(
    data: Prisma.PricingConfigCreateArgs["data"]
  ): Prisma.PricingConfigCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.name = this.trimOptionalString(normalized.name);
    normalized.description = this.trimOptionalString(normalized.description);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.PricingConfigUpdateArgs["data"]
  ): Prisma.PricingConfigUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "name");
    this.normalizeUpdateStringField(normalized, "description");

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

async adminSavePricingConfig(input: {
  body: SavePricingConfigBody;
  actorUserId?: string | null;
}): Promise<any> {
  const pricingConfigId = await this.pricingConfigAdminEngine.saveConfig({
    body: input.body,
    actorUserId: input.actorUserId ?? null,
  });

  return this.domain.findUnique({ id: pricingConfigId });
}
}
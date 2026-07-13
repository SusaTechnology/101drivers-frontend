// src/pricingTier/pricingTier.service.ts

import { Injectable } from "@nestjs/common";
import {
  PricingConfig as PrismaPricingConfig,
  PricingTier as PrismaPricingTier,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PricingTierServiceBase } from "./base/pricingTier.service.base";
import { PricingTierDomain } from "../domain/pricingTier/pricingTier.domain";
import { PricingTierPolicyService } from "../domain/pricingTier/pricingTierPolicy.service";

@Injectable()
export class PricingTierService extends PricingTierServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: PricingTierDomain,
    private readonly policy: PricingTierPolicyService
  ) {
    super(prisma);
  }

  async count(args: Omit<Prisma.PricingTierCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.pricingTier.count(args);
  }

  async pricingTiers(args: Prisma.PricingTierFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async pricingTier(args: Prisma.PricingTierFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPricingTier(args: Prisma.PricingTierCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.pricingTier.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePricingTier(args: Prisma.PricingTierUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.pricingTier.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePricingTier(args: Prisma.PricingTierDeleteArgs): Promise<PrismaPricingTier> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.pricingTier.delete(args);
  }

  async getPricingConfig(parentId: string): Promise<PrismaPricingConfig | null> {
    return this.prisma.pricingTier
      .findUnique({ where: { id: parentId } })
      .pricingConfig();
  }

  private normalizeCreateData(
    data: Prisma.PricingTierCreateArgs["data"]
  ): Prisma.PricingTierCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.PricingTierUpdateArgs["data"]
  ): Prisma.PricingTierUpdateArgs["data"] {
    return { ...data };
  }
}
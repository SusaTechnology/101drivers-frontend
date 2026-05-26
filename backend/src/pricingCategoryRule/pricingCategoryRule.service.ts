// src/pricingCategoryRule/pricingCategoryRule.service.ts

import { Injectable } from "@nestjs/common";
import {
  PricingCategoryRule as PrismaPricingCategoryRule,
  PricingConfig as PrismaPricingConfig,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PricingCategoryRuleServiceBase } from "./base/pricingCategoryRule.service.base";
import { PricingCategoryRuleDomain } from "../domain/pricingCategoryRule/pricingCategoryRule.domain";
import { PricingCategoryRulePolicyService } from "../domain/pricingCategoryRule/pricingCategoryRulePolicy.service";

@Injectable()
export class PricingCategoryRuleService extends PricingCategoryRuleServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: PricingCategoryRuleDomain,
    private readonly policy: PricingCategoryRulePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.PricingCategoryRuleCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.pricingCategoryRule.count(args);
  }

  async pricingCategoryRules(
    args: Prisma.PricingCategoryRuleFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async pricingCategoryRule(
    args: Prisma.PricingCategoryRuleFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPricingCategoryRule(
    args: Prisma.PricingCategoryRuleCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.pricingCategoryRule.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePricingCategoryRule(
    args: Prisma.PricingCategoryRuleUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.pricingCategoryRule.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePricingCategoryRule(
    args: Prisma.PricingCategoryRuleDeleteArgs
  ): Promise<PrismaPricingCategoryRule> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.pricingCategoryRule.delete(args);
  }

  async getPricingConfig(parentId: string): Promise<PrismaPricingConfig | null> {
    return this.prisma.pricingCategoryRule
      .findUnique({ where: { id: parentId } })
      .pricingConfig();
  }

  private normalizeCreateData(
    data: Prisma.PricingCategoryRuleCreateArgs["data"]
  ): Prisma.PricingCategoryRuleCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.PricingCategoryRuleUpdateArgs["data"]
  ): Prisma.PricingCategoryRuleUpdateArgs["data"] {
    return { ...data };
  }
}
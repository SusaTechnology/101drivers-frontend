// src/domain/pricingCategoryRule/pricingCategoryRule.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type PricingCategoryRuleSelect = Prisma.PricingCategoryRuleSelect;
type PricingCategoryRuleWhere = Prisma.PricingCategoryRuleWhereInput;
type PricingCategoryRuleWhereUnique = Prisma.PricingCategoryRuleWhereUniqueInput;
type PricingCategoryRuleFindMany = Prisma.PricingCategoryRuleFindManyArgs;
type PricingCategoryRuleFindUnique = Prisma.PricingCategoryRuleFindUniqueArgs;

@Injectable()
export class PricingCategoryRuleDomain extends BaseDomain<
  PricingCategoryRuleSelect,
  PricingCategoryRuleWhere,
  PricingCategoryRuleWhereUnique,
  PricingCategoryRuleFindMany,
  PricingCategoryRuleFindUnique
> {
  protected enrichSelectFields: PricingCategoryRuleSelect = {
    id: true,
    pricingConfigId: true,
    category: true,
    minMiles: true,
    maxMiles: true,
    baseFee: true,
    perMileRate: true,
    flatPrice: true,
    createdAt: true,
    updatedAt: true,

    pricingConfig: {
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        pricingMode: true,
        baseFee: true,
        perMileRate: true,
        insuranceFee: true,
        transactionFeePct: true,
        transactionFeeFixed: true,
        feePassThrough: true,
        driverSharePct: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.pricingCategoryRule);
  }
}
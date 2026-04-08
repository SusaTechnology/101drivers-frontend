// src/domain/pricingTier/pricingTier.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type PricingTierSelect = Prisma.PricingTierSelect;
type PricingTierWhere = Prisma.PricingTierWhereInput;
type PricingTierWhereUnique = Prisma.PricingTierWhereUniqueInput;
type PricingTierFindMany = Prisma.PricingTierFindManyArgs;
type PricingTierFindUnique = Prisma.PricingTierFindUniqueArgs;

@Injectable()
export class PricingTierDomain extends BaseDomain<
  PricingTierSelect,
  PricingTierWhere,
  PricingTierWhereUnique,
  PricingTierFindMany,
  PricingTierFindUnique
> {
  protected enrichSelectFields: PricingTierSelect = {
    id: true,
    pricingConfigId: true,
    minMiles: true,
    maxMiles: true,
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
    super(prisma.pricingTier);
  }
}
// src/domain/pricingConfig/pricingConfig.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type PricingConfigSelect = Prisma.PricingConfigSelect;
type PricingConfigWhere = Prisma.PricingConfigWhereInput;
type PricingConfigWhereUnique = Prisma.PricingConfigWhereUniqueInput;
type PricingConfigFindMany = Prisma.PricingConfigFindManyArgs;
type PricingConfigFindUnique = Prisma.PricingConfigFindUniqueArgs;

@Injectable()
export class PricingConfigDomain extends BaseDomain<
  PricingConfigSelect,
  PricingConfigWhere,
  PricingConfigWhereUnique,
  PricingConfigFindMany,
  PricingConfigFindUnique
> {
  protected enrichSelectFields: PricingConfigSelect = {
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

    tiers: {
      select: {
        id: true,
        minMiles: true,
        maxMiles: true,
        flatPrice: true,
        pricingConfigId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        minMiles: "asc",
      },
    },

    categoryRules: {
      select: {
        id: true,
        category: true,
        minMiles: true,
        maxMiles: true,
        baseFee: true,
        perMileRate: true,
        flatPrice: true,
        pricingConfigId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { category: "asc" },
        { minMiles: "asc" },
      ],
    },

    customers: {
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        pricingModeOverride: true,
        postpaidEnabled: true,
        pricingConfigId: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    _count: {
      select: {
        tiers: true,
        categoryRules: true,
        customers: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.pricingConfig);
  }
}
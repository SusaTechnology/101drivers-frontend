// src/domain/tip/tip.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type TipSelect = Prisma.TipSelect;
type TipWhere = Prisma.TipWhereInput;
type TipWhereUnique = Prisma.TipWhereUniqueInput;
type TipFindMany = Prisma.TipFindManyArgs;
type TipFindUnique = Prisma.TipFindUniqueArgs;

@Injectable()
export class TipDomain extends BaseDomain<
  TipSelect,
  TipWhere,
  TipWhereUnique,
  TipFindMany,
  TipFindUnique
> {
  protected enrichSelectFields: TipSelect = {
    id: true,
    deliveryId: true,
    amount: true,
    provider: true,
    providerRef: true,
    status: true,
    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        isUrgent: true,
        urgentBonusAmount: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.tip);
  }
}
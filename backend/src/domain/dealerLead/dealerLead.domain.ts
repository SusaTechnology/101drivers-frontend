// src/domain/dealerLead/dealerLead.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DealerLeadSelect = Prisma.DealerLeadSelect;
type DealerLeadWhere = Prisma.DealerLeadWhereInput;
type DealerLeadWhereUnique = Prisma.DealerLeadWhereUniqueInput;
type DealerLeadFindMany = Prisma.DealerLeadFindManyArgs;
type DealerLeadFindUnique = Prisma.DealerLeadFindUniqueArgs;

@Injectable()
export class DealerLeadDomain extends BaseDomain<
  DealerLeadSelect,
  DealerLeadWhere,
  DealerLeadWhereUnique,
  DealerLeadFindMany,
  DealerLeadFindUnique
> {
  protected enrichSelectFields: DealerLeadSelect = {
    id: true,
    businessName: true,
    email: true,
    phone: true,
    message: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.dealerLead);
  }
}
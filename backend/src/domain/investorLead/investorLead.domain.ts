// src/domain/investorLead/investorLead.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type InvestorLeadSelect = Prisma.InvestorLeadSelect;
type InvestorLeadWhere = Prisma.InvestorLeadWhereInput;
type InvestorLeadWhereUnique = Prisma.InvestorLeadWhereUniqueInput;
type InvestorLeadFindMany = Prisma.InvestorLeadFindManyArgs;
type InvestorLeadFindUnique = Prisma.InvestorLeadFindUniqueArgs;

@Injectable()
export class InvestorLeadDomain extends BaseDomain<
  InvestorLeadSelect,
  InvestorLeadWhere,
  InvestorLeadWhereUnique,
  InvestorLeadFindMany,
  InvestorLeadFindUnique
> {
  protected enrichSelectFields: InvestorLeadSelect = {
    id: true,
    name: true,
    email: true,
    message: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.investorLead);
  }
}
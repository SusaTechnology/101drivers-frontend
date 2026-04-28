// src/domain/schedulingPolicy/schedulingPolicy.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type SchedulingPolicySelect = Prisma.SchedulingPolicySelect;
type SchedulingPolicyWhere = Prisma.SchedulingPolicyWhereInput;
type SchedulingPolicyWhereUnique = Prisma.SchedulingPolicyWhereUniqueInput;
type SchedulingPolicyFindMany = Prisma.SchedulingPolicyFindManyArgs;
type SchedulingPolicyFindUnique = Prisma.SchedulingPolicyFindUniqueArgs;

@Injectable()
export class SchedulingPolicyDomain extends BaseDomain<
  SchedulingPolicySelect,
  SchedulingPolicyWhere,
  SchedulingPolicyWhereUnique,
  SchedulingPolicyFindMany,
  SchedulingPolicyFindUnique
> {
  protected enrichSelectFields: SchedulingPolicySelect = {
    id: true,
    active: true,
    afterHoursEnabled: true,
    bufferMinutes: true,
    customerType: true,
    defaultMode: true,
    maxSameDayMiles: true,
    requiresOpsConfirmation: true,
    sameDayCutoffTime: true,
    serviceType: true,
    createdAt: true,
    updatedAt: true,
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.schedulingPolicy);
  }
}
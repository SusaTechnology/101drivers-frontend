// src/domain/scheduleChangeRequest/scheduleChangeRequest.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type ScheduleChangeRequestSelect = Prisma.ScheduleChangeRequestSelect;
type ScheduleChangeRequestWhere = Prisma.ScheduleChangeRequestWhereInput;
type ScheduleChangeRequestWhereUnique = Prisma.ScheduleChangeRequestWhereUniqueInput;
type ScheduleChangeRequestFindMany = Prisma.ScheduleChangeRequestFindManyArgs;
type ScheduleChangeRequestFindUnique = Prisma.ScheduleChangeRequestFindUniqueArgs;

@Injectable()
export class ScheduleChangeRequestDomain extends BaseDomain<
  ScheduleChangeRequestSelect,
  ScheduleChangeRequestWhere,
  ScheduleChangeRequestWhereUnique,
  ScheduleChangeRequestFindMany,
  ScheduleChangeRequestFindUnique
> {
  protected enrichSelectFields: ScheduleChangeRequestSelect = {
    id: true,
    deliveryId: true,
    requestedByUserId: true,
    requestedByRole: true,
    decidedByUserId: true,
    status: true,
    reason: true,
    decisionNote: true,

    proposedPickupWindowStart: true,
    proposedPickupWindowEnd: true,
    proposedDropoffWindowStart: true,
    proposedDropoffWindowEnd: true,

    decidedAt: true,
    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    requestedBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    decidedBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.scheduleChangeRequest);
  }
}
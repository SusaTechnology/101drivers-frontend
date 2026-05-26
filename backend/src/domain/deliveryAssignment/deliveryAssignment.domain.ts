// src/domain/deliveryAssignment/deliveryAssignment.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryAssignmentSelect = Prisma.DeliveryAssignmentSelect;
type DeliveryAssignmentWhere = Prisma.DeliveryAssignmentWhereInput;
type DeliveryAssignmentWhereUnique = Prisma.DeliveryAssignmentWhereUniqueInput;
type DeliveryAssignmentFindMany = Prisma.DeliveryAssignmentFindManyArgs;
type DeliveryAssignmentFindUnique = Prisma.DeliveryAssignmentFindUniqueArgs;

@Injectable()
export class DeliveryAssignmentDomain extends BaseDomain<
  DeliveryAssignmentSelect,
  DeliveryAssignmentWhere,
  DeliveryAssignmentWhereUnique,
  DeliveryAssignmentFindMany,
  DeliveryAssignmentFindUnique
> {
  protected enrichSelectFields: DeliveryAssignmentSelect = {
    id: true,
    deliveryId: true,
    driverId: true,
    assignedByUserId: true,
    assignedAt: true,
    unassignedAt: true,
    reason: true,
    createdAt: true,
    updatedAt: true,

    assignedBy: {
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

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,
        afterHours: true,
        isUrgent: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    driver: {
      select: {
        id: true,
        userId: true,
        status: true,
        phone: true,
        profilePhotoUrl: true,
        approvedAt: true,
        approvedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.deliveryAssignment);
  }
}
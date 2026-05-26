// src/domain/deliveryStatusHistory/deliveryStatusHistory.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryStatusHistorySelect = Prisma.DeliveryStatusHistorySelect;
type DeliveryStatusHistoryWhere = Prisma.DeliveryStatusHistoryWhereInput;
type DeliveryStatusHistoryWhereUnique = Prisma.DeliveryStatusHistoryWhereUniqueInput;
type DeliveryStatusHistoryFindMany = Prisma.DeliveryStatusHistoryFindManyArgs;
type DeliveryStatusHistoryFindUnique = Prisma.DeliveryStatusHistoryFindUniqueArgs;

@Injectable()
export class DeliveryStatusHistoryDomain extends BaseDomain<
  DeliveryStatusHistorySelect,
  DeliveryStatusHistoryWhere,
  DeliveryStatusHistoryWhereUnique,
  DeliveryStatusHistoryFindMany,
  DeliveryStatusHistoryFindUnique
> {
  protected enrichSelectFields: DeliveryStatusHistorySelect = {
    id: true,
    deliveryId: true,
    actorUserId: true,
    actorType: true,
    actorRole: true,
    fromStatus: true,
    toStatus: true,
    note: true,
    createdAt: true,
    updatedAt: true,

    actor: {
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
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.deliveryStatusHistory);
  }
}
// src/domain/driverPayout/driverPayout.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DriverPayoutSelect = Prisma.DriverPayoutSelect;
type DriverPayoutWhere = Prisma.DriverPayoutWhereInput;
type DriverPayoutWhereUnique = Prisma.DriverPayoutWhereUniqueInput;
type DriverPayoutFindMany = Prisma.DriverPayoutFindManyArgs;
type DriverPayoutFindUnique = Prisma.DriverPayoutFindUniqueArgs;

@Injectable()
export class DriverPayoutDomain extends BaseDomain<
  DriverPayoutSelect,
  DriverPayoutWhere,
  DriverPayoutWhereUnique,
  DriverPayoutFindMany,
  DriverPayoutFindUnique
> {
  protected enrichSelectFields: DriverPayoutSelect = {
    id: true,
    deliveryId: true,
    driverId: true,
    grossAmount: true,
    insuranceFee: true,
    platformFee: true,
    netAmount: true,
    driverSharePct: true,
    providerTransferId: true,
    failureMessage: true,
    status: true,
    paidAt: true,
    failedAt: true,
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
    super(prisma.driverPayout);
  }
}
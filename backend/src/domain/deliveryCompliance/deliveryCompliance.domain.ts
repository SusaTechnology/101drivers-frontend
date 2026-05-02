// src/domain/deliveryCompliance/deliveryCompliance.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryComplianceSelect = Prisma.DeliveryComplianceSelect;
type DeliveryComplianceWhere = Prisma.DeliveryComplianceWhereInput;
type DeliveryComplianceWhereUnique = Prisma.DeliveryComplianceWhereUniqueInput;
type DeliveryComplianceFindMany = Prisma.DeliveryComplianceFindManyArgs;
type DeliveryComplianceFindUnique = Prisma.DeliveryComplianceFindUniqueArgs;

@Injectable()
export class DeliveryComplianceDomain extends BaseDomain<
  DeliveryComplianceSelect,
  DeliveryComplianceWhere,
  DeliveryComplianceWhereUnique,
  DeliveryComplianceFindMany,
  DeliveryComplianceFindUnique
> {
  protected enrichSelectFields: DeliveryComplianceSelect = {
    id: true,
    deliveryId: true,
    vinConfirmed: true,
    vinVerificationCode: true,
    odometerStart: true,
    odometerEnd: true,
    pickupCompletedAt: true,
    dropoffCompletedAt: true,
    verifiedByUserId: true,
    verifiedByAdminAt: true,
    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        vinVerificationCode: true,
        licensePlate: true,
        vehicleColor: true,
        vehicleMake: true,
        vehicleModel: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    verifiedBy: {
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
    super(prisma.deliveryCompliance);
  }
}
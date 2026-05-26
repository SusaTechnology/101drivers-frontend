// src/domain/customer/customer.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type CustomerSelect = Prisma.CustomerSelect;
type CustomerWhere = Prisma.CustomerWhereInput;
type CustomerWhereUnique = Prisma.CustomerWhereUniqueInput;
type CustomerFindMany = Prisma.CustomerFindManyArgs;
type CustomerFindUnique = Prisma.CustomerFindUniqueArgs;

@Injectable()
export class CustomerDomain extends BaseDomain<
  CustomerSelect,
  CustomerWhere,
  CustomerWhereUnique,
  CustomerFindMany,
  CustomerFindUnique
> {
  protected enrichSelectFields: CustomerSelect = {
    id: true,
    customerType: true,
    approvalStatus: true,
    approvedAt: true,
    approvedByUserId: true,

    businessName: true,
    businessAddress: true,
    businessPhone: true,
    businessPlaceId: true,
    businessWebsite: true,

    contactName: true,
    contactEmail: true,
    contactPhone: true,

    phone: true,
    postpaidEnabled: true,
    pricingModeOverride: true,
    suspensionReason: true,
    suspendedAt: true,

    pricingConfigId: true,
    defaultPickupId: true,
    userId: true,

    createdAt: true,
    updatedAt: true,

    user: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        emailVerifiedAt: true,
        disabledAt: true,
        disabledReason: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    approvedBy: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
      },
    },

    defaultPickup: {
      select: {
        id: true,
        label: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        lat: true,
        lng: true,
        placeId: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    addresses: {
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        label: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        lat: true,
        lng: true,
        placeId: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    vehicles: {
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        licensePlate: true,
        color: true,
        make: true,
        model: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    pricingConfig: {
      select: {
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
          orderBy: [{ minMiles: "asc" }],
          select: {
            id: true,
            minMiles: true,
            maxMiles: true,
            flatPrice: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        categoryRules: {
          orderBy: [{ minMiles: "asc" }],
          select: {
            id: true,
            category: true,
            minMiles: true,
            maxMiles: true,
            baseFee: true,
            perMileRate: true,
            flatPrice: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },

    _count: {
      select: {
        addresses: true,
        audits: true,
        deliveries: true,
        notifications: true,
        ratings: true,
        vehicles: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.customer);
  }
}
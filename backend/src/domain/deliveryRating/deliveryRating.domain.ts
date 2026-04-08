// src/domain/deliveryRating/deliveryRating.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryRatingSelect = Prisma.DeliveryRatingSelect;
type DeliveryRatingWhere = Prisma.DeliveryRatingWhereInput;
type DeliveryRatingWhereUnique = Prisma.DeliveryRatingWhereUniqueInput;
type DeliveryRatingFindMany = Prisma.DeliveryRatingFindManyArgs;
type DeliveryRatingFindUnique = Prisma.DeliveryRatingFindUniqueArgs;

@Injectable()
export class DeliveryRatingDomain extends BaseDomain<
  DeliveryRatingSelect,
  DeliveryRatingWhere,
  DeliveryRatingWhereUnique,
  DeliveryRatingFindMany,
  DeliveryRatingFindUnique
> {
  protected enrichSelectFields: DeliveryRatingSelect = {
    id: true,
    deliveryId: true,
    customerId: true,
    driverId: true,
    stars: true,
    comment: true,
    target: true,
    createdAt: true,
    updatedAt: true,

    customer: {
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        businessName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        phone: true,
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

    driver: {
      select: {
        id: true,
        userId: true,
        status: true,
        phone: true,
        profilePhotoUrl: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.deliveryRating);
  }
}
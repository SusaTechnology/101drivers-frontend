// src/domain/deliveryEvidence/deliveryEvidence.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DeliveryEvidenceSelect = Prisma.DeliveryEvidenceSelect;
type DeliveryEvidenceWhere = Prisma.DeliveryEvidenceWhereInput;
type DeliveryEvidenceWhereUnique = Prisma.DeliveryEvidenceWhereUniqueInput;
type DeliveryEvidenceFindMany = Prisma.DeliveryEvidenceFindManyArgs;
type DeliveryEvidenceFindUnique = Prisma.DeliveryEvidenceFindUniqueArgs;

@Injectable()
export class DeliveryEvidenceDomain extends BaseDomain<
  DeliveryEvidenceSelect,
  DeliveryEvidenceWhere,
  DeliveryEvidenceWhereUnique,
  DeliveryEvidenceFindMany,
  DeliveryEvidenceFindUnique
> {
  protected enrichSelectFields: DeliveryEvidenceSelect = {
    id: true,
    deliveryId: true,
    type: true,
    phase: true,
    slotIndex: true,
    imageUrl: true,
    value: true,
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
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.deliveryEvidence);
  }
}
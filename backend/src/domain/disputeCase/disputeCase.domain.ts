// src/domain/disputeCase/disputeCase.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type DisputeCaseSelect = Prisma.DisputeCaseSelect;
type DisputeCaseWhere = Prisma.DisputeCaseWhereInput;
type DisputeCaseWhereUnique = Prisma.DisputeCaseWhereUniqueInput;
type DisputeCaseFindMany = Prisma.DisputeCaseFindManyArgs;
type DisputeCaseFindUnique = Prisma.DisputeCaseFindUniqueArgs;

@Injectable()
export class DisputeCaseDomain extends BaseDomain<
  DisputeCaseSelect,
  DisputeCaseWhere,
  DisputeCaseWhereUnique,
  DisputeCaseFindMany,
  DisputeCaseFindUnique
> {
  protected enrichSelectFields: DisputeCaseSelect = {
    id: true,
    deliveryId: true,
    reason: true,
    legalHold: true,
    status: true,
    openedAt: true,
    resolvedAt: true,
    closedAt: true,
    createdAt: true,
    updatedAt: true,

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

    notes: {
      select: {
        id: true,
        disputeId: true,
        authorUserId: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        author: {
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
      },
      orderBy: {
        createdAt: "asc",
      },
    },

    _count: {
      select: {
        notes: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.disputeCase);
  }
}
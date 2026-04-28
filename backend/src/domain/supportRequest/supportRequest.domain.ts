// src/domain/supportRequest/supportRequest.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type Select = Prisma.SupportRequestSelect;
type Where = Prisma.SupportRequestWhereInput;
type WhereUnique = Prisma.SupportRequestWhereUniqueInput;
type FindMany = Prisma.SupportRequestFindManyArgs;
type FindUnique = Prisma.SupportRequestFindUniqueArgs;

@Injectable()
export class SupportRequestDomain extends BaseDomain<
  Select,
  Where,
  WhereUnique,
  FindMany,
  FindUnique
> {
  protected enrichSelectFields: Select = {
    id: true,
    createdAt: true,
    updatedAt: true,

    userId: true,
    actorRole: true,
    actorType: true,

    deliveryId: true,
    category: true,
    priority: true,
    subject: true,
    message: true,
    status: true,

    assignedToUserId: true,
    resolvedAt: true,
    closedAt: true,

    user: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        roles: true,
      },
    },

    assignedTo: {
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        roles: true,
      },
    },

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        pickupAddress: true,
        dropoffAddress: true,
        customerId: true,
        createdByUserId: true,
      },
    },

    notes: {
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        createdAt: true,
        authorUserId: true,
        authorRole: true,
        message: true,
        isInternal: true,
        authorUser: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            roles: true,
          },
        },
      },
    },

    _count: {
      select: {
        notes: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.supportRequest);
  }
}
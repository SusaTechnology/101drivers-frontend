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

/**
 * Full sender identity for support conversations — name, email, phone AND
 * photo. The User row is the account-level source (email/phone/fullName);
 * the role profiles carry the canonical contact + photo data:
 *   - Driver.selfiePhotoUrl / profilePhotoUrl (the onboarding selfie) + phone
 *   - Customer.businessName / businessPhone / contactPhone / phone (dealers)
 * Included for the ticket owner (user), the assignee (assignedTo) and every
 * note author (notes.authorUser) so any viewer of a conversation sees WHO
 * sent each message and how to reach them.
 */
const SUPPORT_USER_IDENTITY_SELECT: Prisma.UserSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  phone: true,
  roles: true,
  driver: {
    select: {
      phone: true,
      profilePhotoUrl: true,
      selfiePhotoUrl: true,
    },
  },
  customer: {
    select: {
      businessName: true,
      businessPhone: true,
      contactName: true,
      contactPhone: true,
      phone: true,
    },
  },
};

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
      select: SUPPORT_USER_IDENTITY_SELECT,
    },

    assignedTo: {
      select: SUPPORT_USER_IDENTITY_SELECT,
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
          select: SUPPORT_USER_IDENTITY_SELECT,
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
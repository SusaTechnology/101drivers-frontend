// src/domain/adminAuditLog/adminAuditLog.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type AdminAuditLogSelect = Prisma.AdminAuditLogSelect;
type AdminAuditLogWhere = Prisma.AdminAuditLogWhereInput;
type AdminAuditLogWhereUnique = Prisma.AdminAuditLogWhereUniqueInput;
type AdminAuditLogFindMany = Prisma.AdminAuditLogFindManyArgs;
type AdminAuditLogFindUnique = Prisma.AdminAuditLogFindUniqueArgs;

@Injectable()
export class AdminAuditLogDomain extends BaseDomain<
  AdminAuditLogSelect,
  AdminAuditLogWhere,
  AdminAuditLogWhereUnique,
  AdminAuditLogFindMany,
  AdminAuditLogFindUnique
> {
  protected enrichSelectFields: AdminAuditLogSelect = {
    id: true,
    action: true,
    actorUserId: true,
    actorType: true,
    userId: true,
    customerId: true,
    deliveryId: true,
    driverId: true,
    reason: true,
    beforeJson: true,
    afterJson: true,
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

    user: {
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
    super(prisma.adminAuditLog);
  }
}
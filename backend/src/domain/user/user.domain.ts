import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type UserSelect = Prisma.UserSelect;
type UserWhere = Prisma.UserWhereInput;
type UserWhereUnique = Prisma.UserWhereUniqueInput;
type UserFindMany = Prisma.UserFindManyArgs;
type UserFindUnique = Prisma.UserFindUniqueArgs;

@Injectable()
export class UserDomain extends BaseDomain<
  UserSelect,
  UserWhere,
  UserWhereUnique,
  UserFindMany,
  UserFindUnique
> {
  protected enrichSelectFields: UserSelect = {
    id: true,
    email: true,
    username: true,
    fullName: true,
    phone: true,
    roles: true,
    isActive: true,
    disabledAt: true,
    disabledReason: true,
    emailVerifiedAt: true,
    lastLoginAt: true,
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
        suspendedAt: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    driver: {
      select: {
        id: true,
        status: true,
        phone: true,
        profilePhotoUrl: true,
        approvedAt: true,
        approvedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    customersApproved: {
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        businessName: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    driversApproved: {
      select: {
        id: true,
        status: true,
        phone: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    _count: {
      select: {
        adminActions: true,
        assignmentsMade: true,
        auditTargets: true,
        compliancesVerified: true,
        customersApproved: true,
        deliveriesCreated: true,
        disputeNotesAuthored: true,
        driversApproved: true,
        exportsCreated: true,
        notifEvents: true,
        scheduleChangesDecided: true,
        scheduleChangesRequested: true,
        statusActions: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.user);
  }
}
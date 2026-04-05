// src/domain/notificationEvent/notificationEvent.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type NotificationEventSelect = Prisma.NotificationEventSelect;
type NotificationEventWhere = Prisma.NotificationEventWhereInput;
type NotificationEventWhereUnique = Prisma.NotificationEventWhereUniqueInput;
type NotificationEventFindMany = Prisma.NotificationEventFindManyArgs;
type NotificationEventFindUnique = Prisma.NotificationEventFindUniqueArgs;

@Injectable()
export class NotificationEventDomain extends BaseDomain<
  NotificationEventSelect,
  NotificationEventWhere,
  NotificationEventWhereUnique,
  NotificationEventFindMany,
  NotificationEventFindUnique
> {
  protected enrichSelectFields: NotificationEventSelect = {
    id: true,
    actorUserId: true,
    customerId: true,
    deliveryId: true,
    driverId: true,
    channel: true,
    type: true,
    status: true,
    subject: true,
    body: true,
    templateCode: true,
    toEmail: true,
    toPhone: true,
    errorMessage: true,
    payload: true,
    sentAt: true,
    failedAt: true,
    createdAt: true,
    updatedAt: true,

    isRead: true,
    seenInListAt: true,
    openedAt: true,
    readAt: true,
    clickedAt: true,
    archivedAt: true,
    dismissedAt: true,
    expiresAt: true,

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
    super(prisma.notificationEvent);
  }
}
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumNotificationEventChannel,
  EnumNotificationEventType,
  EnumSupportActorRole,
  EnumSupportActorType,
  EnumSupportPriority,
  EnumSupportStatus,
  Prisma,
  SupportRequestNote,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";

type Tx = Prisma.TransactionClient;

@Injectable()
export class SupportRequestOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  // ==============================
  // CREATE SUPPORT
  // ==============================
  async createContactRequest(input: {
    actorUserId?: string | null;
    actorRole: EnumSupportActorRole;
    actorType: EnumSupportActorType;
    deliveryId?: string | null;
    category: any;
    priority: EnumSupportPriority;
    subject?: string | null;
    message: string;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      if (input.deliveryId) {
        await this.assertActorCanAccessDeliveryTx(tx, {
          deliveryId: input.deliveryId,
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole,
        });
      }

      const created = await tx.supportRequest.create({
        data: {
          userId: input.actorUserId ?? null,
          actorRole: input.actorRole,
          actorType: input.actorType,
          deliveryId: input.deliveryId ?? null,
          category: input.category,
          priority: input.priority,
          subject: input.subject ?? null,
          message: input.message,
          status: EnumSupportStatus.OPEN,
        },
        select: { id: true },
      });

      await tx.supportRequestNote.create({
        data: {
          supportRequestId: created.id,
          authorUserId: input.actorUserId ?? null,
          authorRole: input.actorRole,
          message: input.message,
          isInternal: false,
        },
      });

      // 🔔 Notify ops/admin (simple version → email required externally)
      await this.notificationEventEngine.queueAndSend({
        actorUserId: input.actorUserId ?? null,
        deliveryId: input.deliveryId ?? null,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.SUPPORT_REQUEST_CREATED,
        templateCode: "support-created",
        toEmail: "ops@101drivers.techbee.et", // 🔥 later replace with real routing
        subject: "New Support Request",
        body: input.message,
        payload: {
          supportRequestId: created.id,
          category: input.category,
          priority: input.priority,
        },
      });

      return created;
    });
  }

  // ==============================
  // REPLY
  // ==============================
  async replyToSupportRequest(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    authorRole: EnumSupportActorRole;
    message: string;
    isInternal: boolean;
  }): Promise<SupportRequestNote> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supportRequest.findUnique({
        where: { id: input.supportRequestId },
        select: {
          id: true,
          userId: true,
          assignedToUserId: true,
          deliveryId: true,
          status: true,
        },
      });

      if (!request) throw new NotFoundException();

      if (request.status === EnumSupportStatus.CLOSED) {
        throw new BadRequestException("Cannot reply to closed request");
      }

      const note = await tx.supportRequestNote.create({
        data: {
          supportRequestId: input.supportRequestId,
          authorUserId: input.actorUserId ?? null,
          authorRole: input.authorRole,
          message: input.message,
          isInternal: input.isInternal,
        },
      });

      await tx.supportRequest.update({
        where: { id: input.supportRequestId },
        data: { status: EnumSupportStatus.IN_PROGRESS },
      });

      if (!input.isInternal && request.userId) {
        const user = await tx.user.findUnique({
          where: { id: request.userId },
          select: { email: true },
        });

        if (user?.email) {
          await this.notificationEventEngine.queueAndSend({
            actorUserId: input.actorUserId ?? null,
            deliveryId: request.deliveryId ?? null,
            channel: EnumNotificationEventChannel.EMAIL,
            type: EnumNotificationEventType.SUPPORT_REQUEST_REPLIED,
            templateCode: "support-replied",
            toEmail: user.email,
            subject: "Support Request Updated",
            body: input.message,
            payload: { supportRequestId: request.id },
          });
        }
      }

      return note;
    });
  }

  // ==============================
  // ASSIGN
  // ==============================
  async assignSupportRequest(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    assignedToUserId: string;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supportRequest.findUniqueOrThrow({
        where: { id: input.supportRequestId },
      });

      const user = await tx.user.findUnique({
        where: { id: input.assignedToUserId },
        select: { email: true },
      });

      await tx.supportRequest.update({
        where: { id: input.supportRequestId },
        data: {
          assignedToUserId: input.assignedToUserId,
          status: EnumSupportStatus.IN_PROGRESS,
        },
      });

      if (user?.email) {
        await this.notificationEventEngine.queueAndSend({
          actorUserId: input.actorUserId ?? null,
          deliveryId: request.deliveryId ?? null,
          channel: EnumNotificationEventChannel.EMAIL,
          type: EnumNotificationEventType.SUPPORT_REQUEST_ASSIGNED,
          templateCode: "support-assigned",
          toEmail: user.email,
          subject: "Support Request Assigned",
          body: "A support request has been assigned to you",
          payload: { supportRequestId: request.id },
        });
      }

      return { id: request.id };
    });
  }

  // ==============================
  // STATUS CHANGE
  // ==============================
  async changeSupportRequestStatus(input: {
    supportRequestId: string;
    actorUserId?: string | null;
    status: EnumSupportStatus;
  }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supportRequest.findUniqueOrThrow({
        where: { id: input.supportRequestId },
      });

      await tx.supportRequest.update({
        where: { id: input.supportRequestId },
        data: { status: input.status },
      });

      if (request.userId) {
        const user = await tx.user.findUnique({
          where: { id: request.userId },
          select: { email: true },
        });

        if (user?.email) {
          await this.notificationEventEngine.queueAndSend({
            actorUserId: input.actorUserId ?? null,
            deliveryId: request.deliveryId ?? null,
            channel: EnumNotificationEventChannel.EMAIL,
            type: EnumNotificationEventType.SUPPORT_REQUEST_RESOLVED,
            templateCode: "support-status",
            toEmail: user.email,
            subject: `Support Request ${input.status}`,
            body: `Status changed to ${input.status}`,
            payload: { supportRequestId: request.id },
          });
        }
      }

      return { id: request.id };
    });
  }

  // ==============================
  // ACCESS CONTROL
  // ==============================
  private async assertActorCanAccessDeliveryTx(
    tx: Tx,
    input: {
      deliveryId: string;
      actorUserId?: string | null;
      actorRole: EnumSupportActorRole;
    }
  ) {
    if (!input.actorUserId) throw new ForbiddenException();

    const delivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        customer: { select: { userId: true } },
        assignments: {
          where: { unassignedAt: null },
          take: 1,
          select: { driver: { select: { userId: true } } },
        },
      },
    });

    if (!delivery) throw new NotFoundException();

    const customerUserId = delivery.customer?.userId;
    const driverUserId = delivery.assignments?.[0]?.driver?.userId;

    if (
      input.actorRole === EnumSupportActorRole.PRIVATE_CUSTOMER &&
      customerUserId !== input.actorUserId
    ) {
      throw new ForbiddenException();
    }

    if (
      input.actorRole === EnumSupportActorRole.DRIVER &&
      driverUserId !== input.actorUserId
    ) {
      throw new ForbiddenException();
    }
  }
}
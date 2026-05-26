import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDisputeCaseStatus,
  EnumNotificationEventChannel,
  EnumNotificationEventStatus,
  EnumNotificationEventType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DisputeAdminEngine {
  constructor(private readonly prisma: PrismaService) {}

  async openDispute(input: {
    deliveryId: string;
    reason: string;
    actorUserId?: string | null;
  }): Promise<string> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        dispute: {
          select: {
            id: true,
            status: true,
          },
        },
        customerId: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.dispute?.id) {
      throw new BadRequestException("Dispute already exists for this delivery");
    }

    const dispute = await this.prisma.disputeCase.create({
      data: {
        deliveryId: input.deliveryId,
        reason: input.reason.trim(),
        status: EnumDisputeCaseStatus.OPEN,
        openedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: input.deliveryId,
        reason: input.reason.trim(),
        beforeJson: Prisma.JsonNull,
        afterJson: {
          disputeId: dispute.id,
          status: EnumDisputeCaseStatus.OPEN,
          reason: input.reason.trim(),
        },
      },
    });

    await this.prisma.notificationEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        customerId: delivery.customerId,
        deliveryId: input.deliveryId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DISPUTE_OPENED,
        status: EnumNotificationEventStatus.QUEUED,
        templateCode: "dispute-opened",
        subject: "Dispute opened for delivery",
        body: "A dispute has been opened for this delivery and is awaiting review.",
        payload: {
          disputeId: dispute.id,
          deliveryId: input.deliveryId,
        },
      },
    });

    return dispute.id;
  }

  async addDisputeNote(input: {
    disputeId: string;
    note: string;
    actorUserId?: string | null;
  }): Promise<void> {
    const dispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        deliveryId: true,
        status: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    await this.prisma.disputeNote.create({
      data: {
        disputeId: input.disputeId,
        authorUserId: input.actorUserId ?? null,
        note: input.note.trim(),
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: dispute.deliveryId,
        reason: "Dispute note added",
        beforeJson: Prisma.JsonNull,
        afterJson: {
          disputeId: input.disputeId,
          note: input.note.trim(),
        },
      },
    });

    await this.prisma.notificationEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        deliveryId: dispute.deliveryId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DISPUTE_UPDATED,
        status: EnumNotificationEventStatus.QUEUED,
        templateCode: "dispute-note-added",
        subject: "Dispute updated",
        body: "A new note was added to the dispute.",
        payload: {
          disputeId: input.disputeId,
        },
      },
    });
  }

  async updateDisputeStatus(input: {
    disputeId: string;
    status: EnumDisputeCaseStatus;
    note?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    const dispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        deliveryId: true,
        status: true,
        legalHold: true,
        reason: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    if (dispute.status === EnumDisputeCaseStatus.CLOSED) {
      throw new BadRequestException("Closed disputes cannot be updated");
    }

    const beforeJson = dispute;

    const updateData: Prisma.DisputeCaseUpdateInput = {
      status: input.status,
    };

    if (input.status === EnumDisputeCaseStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    }

    if (input.status === EnumDisputeCaseStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    await this.prisma.disputeCase.update({
      where: { id: input.disputeId },
      data: updateData,
    });

    if (input.note?.trim()) {
      await this.prisma.disputeNote.create({
        data: {
          disputeId: input.disputeId,
          authorUserId: input.actorUserId ?? null,
          note: input.note.trim(),
        },
      });
    }

    const afterDispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        status: true,
        legalHold: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: dispute.deliveryId,
        reason: input.note?.trim() ?? `Dispute moved to ${input.status}`,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDispute ?? Prisma.JsonNull,
      },
    });

    await this.prisma.notificationEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        deliveryId: dispute.deliveryId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DISPUTE_UPDATED,
        status: EnumNotificationEventStatus.QUEUED,
        templateCode: "dispute-status-updated",
        subject: "Dispute status updated",
        body: `Dispute status changed to ${input.status}.`,
        payload: {
          disputeId: input.disputeId,
          status: input.status,
        },
      },
    });
  }

  async resolveDispute(input: {
    disputeId: string;
    resolutionNote?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    await this.updateDisputeStatus({
      disputeId: input.disputeId,
      status: EnumDisputeCaseStatus.RESOLVED,
      note: input.resolutionNote ?? null,
      actorUserId: input.actorUserId ?? null,
    });
  }

  async closeDispute(input: {
    disputeId: string;
    closingNote?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    const dispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    if (
      dispute.status !== EnumDisputeCaseStatus.RESOLVED &&
      dispute.status !== EnumDisputeCaseStatus.UNDER_REVIEW &&
      dispute.status !== EnumDisputeCaseStatus.OPEN
    ) {
      throw new BadRequestException("Dispute cannot be closed from current status");
    }

    await this.updateDisputeStatus({
      disputeId: input.disputeId,
      status: EnumDisputeCaseStatus.CLOSED,
      note: input.closingNote ?? null,
      actorUserId: input.actorUserId ?? null,
    });
  }

  async toggleLegalHold(input: {
    disputeId: string;
    legalHold: boolean;
    note?: string | null;
    actorUserId?: string | null;
  }): Promise<void> {
    const dispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        deliveryId: true,
        legalHold: true,
        status: true,
        reason: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    const beforeJson = dispute;

    await this.prisma.disputeCase.update({
      where: { id: input.disputeId },
      data: {
        legalHold: input.legalHold,
      },
    });

    if (input.note?.trim()) {
      await this.prisma.disputeNote.create({
        data: {
          disputeId: input.disputeId,
          authorUserId: input.actorUserId ?? null,
          note: input.note.trim(),
        },
      });
    }

    const afterDispute = await this.prisma.disputeCase.findUnique({
      where: { id: input.disputeId },
      select: {
        id: true,
        legalHold: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: dispute.deliveryId,
        reason:
          input.note?.trim() ??
          (input.legalHold ? "Legal hold enabled" : "Legal hold removed"),
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDispute ?? Prisma.JsonNull,
      },
    });

    await this.prisma.notificationEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        deliveryId: dispute.deliveryId,
        channel: EnumNotificationEventChannel.EMAIL,
        type: EnumNotificationEventType.DISPUTE_UPDATED,
        status: EnumNotificationEventStatus.QUEUED,
        templateCode: "dispute-legal-hold-updated",
        subject: "Dispute legal hold updated",
        body: input.legalHold
          ? "Legal hold has been enabled for this dispute."
          : "Legal hold has been removed for this dispute.",
        payload: {
          disputeId: input.disputeId,
          legalHold: input.legalHold,
        },
      },
    });
  }
}

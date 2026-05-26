import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryToStatus,
  EnumDriverStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";

@Injectable()
export class AdminDeliveryEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}
async assignDriver(input: {
  deliveryId: string;
  driverId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      assignments: {
        where: {
          unassignedAt: null,
        },
        select: {
          id: true,
          driverId: true,
          assignedAt: true,
          unassignedAt: true,
        },
      },
    },
  });

  if (!delivery) {
    throw new NotFoundException("Delivery not found");
  }

  if (
    delivery.status !== EnumDeliveryRequestStatus.QUOTED &&
    delivery.status !== EnumDeliveryRequestStatus.LISTED
  ) {
    throw new BadRequestException(
      "Delivery can only be assigned from QUOTED or LISTED state"
    );
  }

  if ((delivery.assignments?.length ?? 0) > 0) {
    throw new BadRequestException("Delivery already has an active assignment");
  }

  const driver = await this.prisma.driver.findUnique({
    where: { id: input.driverId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!driver) {
    throw new NotFoundException("Driver not found");
  }

  if (driver.status !== EnumDriverStatus.APPROVED) {
    throw new BadRequestException("Driver is not approved");
  }

  const busyAssignment = await this.prisma.deliveryAssignment.findFirst({
    where: {
      driverId: input.driverId,
      unassignedAt: null,
      delivery: {
        status: {
          in: [
            EnumDeliveryRequestStatus.BOOKED,
            EnumDeliveryRequestStatus.ACTIVE,
          ],
        },
      },
    },
    select: {
      id: true,
      deliveryId: true,
    },
  });

  if (busyAssignment) {
    throw new BadRequestException("Driver already has an active delivery");
  }

  const beforeJson = {
    deliveryId: delivery.id,
    status: delivery.status,
    activeAssignments: delivery.assignments ?? [],
  };

  await this.prisma.$transaction(async (tx) => {
    await tx.deliveryAssignment.create({
      data: {
        deliveryId: input.deliveryId,
        driverId: input.driverId,
        assignedByUserId: input.actorUserId ?? null,
        reason: input.reason ?? "Admin assigned driver",
      },
    });

    await tx.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.BOOKED,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: delivery.status as any,
        toStatus: EnumDeliveryStatusHistoryToStatus.BOOKED,
        note: input.reason ?? "Driver assigned by admin",
      },
    });

    const afterJson = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        assignments: {
          where: {
            unassignedAt: null,
          },
          select: {
            id: true,
            driverId: true,
            assignedAt: true,
            unassignedAt: true,
          },
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DELIVERY_REASSIGN,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: input.deliveryId,
        driverId: input.driverId,
        reason: input.reason ?? "Driver assigned by admin",
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterJson ?? Prisma.JsonNull,
      },
    });
  });

  await this.notificationEventEngine.notifyDeliveryAssigned({
    deliveryId: input.deliveryId,
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
  });
}
  async cancelDelivery(input: {
    deliveryId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (
      delivery.status === EnumDeliveryRequestStatus.COMPLETED ||
      delivery.status === EnumDeliveryRequestStatus.CANCELLED
    ) {
      throw new BadRequestException("Delivery cannot be cancelled");
    }

    const beforeJson = delivery;

    await this.prisma.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.CANCELLED,
      },
    });

    const activeAssignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        deliveryId: input.deliveryId,
        unassignedAt: null,
      },
      select: { id: true },
    });

    for (const row of activeAssignments) {
      await this.prisma.deliveryAssignment.update({
        where: { id: row.id },
        data: {
          unassignedAt: new Date(),
        },
      });
    }

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: delivery.status as any,
        toStatus: EnumDeliveryStatusHistoryToStatus.CANCELLED,
        note: input.reason,
      },
    });

    const afterDelivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DELIVERY_CANCEL,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: input.deliveryId,
        reason: input.reason,
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterDelivery ?? Prisma.JsonNull,
      },
    });
  }

  async forceCancelDelivery(input: {
    deliveryId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        payment: {
          select: {
            id: true,
            status: true,
          },
        },
        payout: {
          select: {
            id: true,
            status: true,
          },
        },
        trackingSession: {
          select: {
            id: true,
            status: true,
          },
        },
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            id: true,
            driverId: true,
          },
        },
        dispute: {
          select: {
            id: true,
            status: true,
            legalHold: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (
      delivery.status === EnumDeliveryRequestStatus.COMPLETED ||
      delivery.status === EnumDeliveryRequestStatus.CANCELLED
    ) {
      throw new BadRequestException("Delivery cannot be force-cancelled");
    }

    const activeDriverId = delivery.assignments?.[0]?.driverId ?? null;
    const now = new Date();

    const beforeJson = {
      id: delivery.id,
      status: delivery.status,
      payment: delivery.payment,
      payout: delivery.payout,
      trackingSession: delivery.trackingSession,
      dispute: delivery.dispute,
      assignments: delivery.assignments,
    };

    await this.prisma.$transaction(async (tx) => {
      if (delivery.assignments?.[0]?.id) {
        await tx.deliveryAssignment.update({
          where: { id: delivery.assignments[0].id },
          data: {
            unassignedAt: now,
            reason: `Force-cancelled by admin: ${input.reason}`,
          },
        });
      }

      if (delivery.trackingSession?.id) {
        await tx.trackingSession.update({
          where: { id: delivery.trackingSession.id },
          data: {
            stoppedAt: now,
            status: "STOPPED" as any,
          },
        });
      }

      if (delivery.payout?.id) {
        await tx.driverPayout.updateMany({
          where: {
            id: delivery.payout.id,
            status: {
              notIn: ["PAID", "CANCELLED"] as any,
            },
          },
          data: {
            status: "CANCELLED" as any,
            failureMessage: "Force-cancelled by admin",
          },
        });
      }

      if (delivery.dispute?.id) {
        await tx.disputeCase.update({
          where: { id: delivery.dispute.id },
          data: {
            legalHold: false,
          },
        });
      }

      await tx.deliveryRequest.update({
        where: { id: input.deliveryId },
        data: {
          status: EnumDeliveryRequestStatus.CANCELLED,
        },
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: input.deliveryId,
          actorUserId: input.actorUserId ?? null,
          actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          fromStatus: delivery.status as any,
          toStatus: EnumDeliveryStatusHistoryToStatus.CANCELLED,
          note: `Force-cancelled by admin: ${input.reason}`,
        },
      });

      const afterJson = await tx.deliveryRequest.findUnique({
        where: { id: input.deliveryId },
        select: {
          id: true,
          status: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.DELIVERY_CANCEL,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          driverId: activeDriverId,
          reason: `Force-cancelled by admin: ${input.reason}`,
          beforeJson: beforeJson ?? Prisma.JsonNull,
          afterJson: afterJson ?? Prisma.JsonNull,
        },
      });
    });

    await this.notificationEventEngine.notifyDeliveryForceCancelled({
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
      driverId: activeDriverId,
      reason: input.reason,
    });
  }

  async openDispute(input: {
    deliveryId: string;
    actorUserId?: string | null;
    reason: string;
    note?: string | null;
    legalHold?: boolean;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        dispute: {
          select: {
            id: true,
            status: true,
            legalHold: true,
            reason: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.status === EnumDeliveryRequestStatus.CANCELLED) {
      throw new BadRequestException("Cancelled delivery cannot be disputed");
    }

    if (delivery.dispute?.id) {
      throw new BadRequestException("Dispute already exists for this delivery");
    }

    const beforeJson = {
      deliveryId: delivery.id,
      status: delivery.status,
      dispute: delivery.dispute,
    };

    await this.prisma.$transaction(async (tx) => {
      const dispute = await tx.disputeCase.create({
        data: {
          deliveryId: input.deliveryId,
          reason: input.reason,
          status: "OPEN" as any,
          legalHold: input.legalHold === true,
          openedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          legalHold: true,
          reason: true,
        },
      });

      await tx.deliveryRequest.update({
        where: { id: input.deliveryId },
        data: {
          status: EnumDeliveryRequestStatus.DISPUTED,
          dispute: {
            connect: { id: dispute.id },
          },
        },
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: input.deliveryId,
          actorUserId: input.actorUserId ?? null,
          actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          fromStatus: delivery.status as any,
          toStatus: EnumDeliveryStatusHistoryToStatus.DISPUTED,
          note: input.note ?? input.reason,
        },
      });

      const afterJson = await tx.deliveryRequest.findUnique({
        where: { id: input.deliveryId },
        select: {
          id: true,
          status: true,
          dispute: {
            select: {
              id: true,
              status: true,
              legalHold: true,
              reason: true,
            },
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.OTHER,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          reason: input.note ?? input.reason,
          beforeJson: beforeJson ?? Prisma.JsonNull,
          afterJson: afterJson ?? Prisma.JsonNull,
        },
      });
    });

    await this.notificationEventEngine.notifyDisputeOpened({
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason,
      legalHold: input.legalHold === true,
    });
  }

  async setLegalHold(input: {
    deliveryId: string;
    actorUserId?: string | null;
    legalHold: boolean;
    note?: string | null;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        dispute: {
          select: {
            id: true,
            status: true,
            legalHold: true,
            reason: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (!delivery.dispute?.id) {
      throw new BadRequestException("Delivery does not have an open dispute");
    }

    const beforeJson = {
      deliveryId: delivery.id,
      status: delivery.status,
      dispute: delivery.dispute,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.disputeCase.update({
        where: { id: delivery.dispute!.id },
        data: {
          legalHold: input.legalHold,
        },
      });

      const afterJson = await tx.deliveryRequest.findUnique({
        where: { id: input.deliveryId },
        select: {
          id: true,
          status: true,
          dispute: {
            select: {
              id: true,
              status: true,
              legalHold: true,
              reason: true,
            },
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          reason: input.note ?? (input.legalHold ? "Legal hold enabled" : "Legal hold removed"),
          beforeJson: beforeJson ?? Prisma.JsonNull,
          afterJson: afterJson ?? Prisma.JsonNull,
        },
      });
    });

    await this.notificationEventEngine.notifyLegalHoldUpdated({
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
      legalHold: input.legalHold,
      note: input.note ?? null,
    });
  }
  async approveCompliance(input: {
  deliveryId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<void> {
  const delivery = await this.prisma.deliveryRequest.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      customerId: true,
      compliance: {
        select: {
          id: true,
          vinConfirmed: true,
          vinVerificationCode: true,
          odometerStart: true,
          odometerEnd: true,
          pickupCompletedAt: true,
          dropoffCompletedAt: true,
          verifiedByUserId: true,
          verifiedByAdminAt: true,
        },
      },
    },
  });

  if (!delivery) {
    throw new NotFoundException("Delivery not found");
  }

  if (!delivery.compliance?.id) {
    throw new BadRequestException("Delivery does not have a compliance record");
  }

  if (delivery.compliance.verifiedByAdminAt) {
    throw new BadRequestException("Compliance has already been approved");
  }

  const hasPickupEvidence =
    delivery.compliance.vinVerificationCode != null ||
    delivery.compliance.odometerStart != null ||
    delivery.compliance.pickupCompletedAt != null;

  const hasDropoffEvidence =
    delivery.compliance.odometerEnd != null ||
    delivery.compliance.dropoffCompletedAt != null;

  if (!hasPickupEvidence && !hasDropoffEvidence) {
    throw new BadRequestException(
      "Compliance cannot be approved because no compliance data is present"
    );
  }

  const beforeJson = {
    deliveryId: delivery.id,
    status: delivery.status,
    compliance: delivery.compliance,
  };

  await this.prisma.$transaction(async (tx) => {
    await tx.deliveryCompliance.update({
      where: { id: delivery.compliance!.id },
      data: {
        verifiedByUserId: input.actorUserId ?? null,
        verifiedByAdminAt: new Date(),
      },
    });

    const afterJson = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        compliance: {
          select: {
            id: true,
            vinConfirmed: true,
            vinVerificationCode: true,
            odometerStart: true,
            odometerEnd: true,
            pickupCompletedAt: true,
            dropoffCompletedAt: true,
            verifiedByUserId: true,
            verifiedByAdminAt: true,
          },
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: input.deliveryId,
        reason: input.note ?? "Compliance approved by admin",
        beforeJson: beforeJson ?? Prisma.JsonNull,
        afterJson: afterJson ?? Prisma.JsonNull,
      },
    });
  });

  await this.notificationEventEngine.notifyComplianceApproved({
    deliveryId: input.deliveryId,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });
}

  async reassignDelivery(input: {
    deliveryId: string;
    newDriverId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (
      delivery.status !== EnumDeliveryRequestStatus.LISTED &&
      delivery.status !== EnumDeliveryRequestStatus.BOOKED
    ) {
      throw new BadRequestException(
        "Delivery can only be reassigned from LISTED or BOOKED state"
      );
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: input.newDriverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (driver.status !== EnumDriverStatus.APPROVED) {
      throw new BadRequestException("Driver is not approved");
    }

    const beforeAssignments = await this.prisma.deliveryAssignment.findMany({
      where: {
        deliveryId: input.deliveryId,
        unassignedAt: null,
      },
      select: {
        id: true,
        driverId: true,
        assignedAt: true,
        unassignedAt: true,
      },
    });

    await this.prisma.deliveryAssignment.updateMany({
      where: {
        deliveryId: input.deliveryId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
    });

    await this.prisma.deliveryAssignment.create({
      data: {
        deliveryId: input.deliveryId,
        driverId: input.newDriverId,
        assignedByUserId: input.actorUserId ?? null,
        reason: input.reason ?? "Admin reassignment",
      },
    });

    await this.prisma.deliveryRequest.update({
      where: { id: input.deliveryId },
      data: {
        status: EnumDeliveryRequestStatus.BOOKED,
      },
    });

    await this.prisma.deliveryStatusHistory.create({
      data: {
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        fromStatus: delivery.status as any,
        toStatus: EnumDeliveryStatusHistoryToStatus.BOOKED,
        note: input.reason ?? "Delivery reassigned by admin",
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.DELIVERY_REASSIGN,
        actorUserId: input.actorUserId ?? null,
        actorType: EnumAdminAuditLogActorType.USER,
        deliveryId: input.deliveryId,
        driverId: input.newDriverId,
        reason: input.reason ?? null,
        beforeJson: beforeAssignments ?? Prisma.JsonNull,
        afterJson: {
          deliveryId: input.deliveryId,
          newDriverId: input.newDriverId,
          status: EnumDeliveryRequestStatus.BOOKED,
        },
      },
    });
  }
}
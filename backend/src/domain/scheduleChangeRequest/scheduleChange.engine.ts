// src/domain/scheduleChangeRequest/scheduleChange.engine.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryFromStatus,
  EnumDeliveryStatusHistoryToStatus,
  EnumScheduleChangeRequestRequestedByRole,
  EnumScheduleChangeRequestStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";

type Tx = Prisma.TransactionClient | PrismaService;
type ScheduleDecisionOutcome = "APPROVED" | "DECLINED" | "CANCELLED";

@Injectable()
export class ScheduleChangeEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  async requestScheduleChange(input: {
    deliveryId: string;
    requestedByUserId?: string | null;
    requestedByRole?: EnumScheduleChangeRequestRequestedByRole | null;
    proposedPickupWindowStart?: Date | null;
    proposedPickupWindowEnd?: Date | null;
    proposedDropoffWindowStart?: Date | null;
    proposedDropoffWindowEnd?: Date | null;
    reason?: string | null;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const delivery = await this.getDeliveryOrThrow(input.deliveryId, tx);

      this.assertDeliveryAllowsScheduleChange(delivery.status);
      this.validateRequestedWindows({
        currentPickupWindowStart: delivery.pickupWindowStart,
        currentPickupWindowEnd: delivery.pickupWindowEnd,
        currentDropoffWindowStart: delivery.dropoffWindowStart,
        currentDropoffWindowEnd: delivery.dropoffWindowEnd,
        proposedPickupWindowStart: input.proposedPickupWindowStart ?? null,
        proposedPickupWindowEnd: input.proposedPickupWindowEnd ?? null,
        proposedDropoffWindowStart: input.proposedDropoffWindowStart ?? null,
        proposedDropoffWindowEnd: input.proposedDropoffWindowEnd ?? null,
      });

      const existingPending = await tx.scheduleChangeRequest.findFirst({
        where: {
          deliveryId: input.deliveryId,
          status: EnumScheduleChangeRequestStatus.PENDING,
        },
        select: { id: true },
      });

      if (existingPending) {
        throw new BadRequestException(
          "A pending schedule change request already exists for this delivery"
        );
      }

      const created = await tx.scheduleChangeRequest.create({
        data: {
          deliveryId: input.deliveryId,
          requestedByUserId: input.requestedByUserId ?? null,
          requestedByRole: input.requestedByRole ?? null,
          proposedPickupWindowStart: input.proposedPickupWindowStart ?? null,
          proposedPickupWindowEnd: input.proposedPickupWindowEnd ?? null,
          proposedDropoffWindowStart: input.proposedDropoffWindowStart ?? null,
          proposedDropoffWindowEnd: input.proposedDropoffWindowEnd ?? null,
          reason: this.trimOrNull(input.reason),
          status: EnumScheduleChangeRequestStatus.PENDING,
        },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          requestedByUserId: true,
          requestedByRole: true,
          reason: true,
        },
      });

      await this.createDeliveryStatusHistoryNote(
        tx,
        input.deliveryId,
        delivery.status,
        `Schedule change requested${
          input.reason ? `: ${this.trimOrNull(input.reason)}` : ""
        }`,
        input.requestedByUserId ?? null,
        this.mapScheduleRequestedByRoleToDeliveryActorRole(
          input.requestedByRole ?? null
        )
      );

      return created;
    });

    await this.notificationEventEngine.notifyScheduleChangeRequested({
      deliveryId: result.deliveryId,
      actorUserId: input.requestedByUserId ?? null,
      requestedByRole: input.requestedByRole ?? null,
      reason: this.trimOrNull(input.reason),
    });

    return result;
  }

  async approveScheduleChange(input: {
    scheduleChangeRequestId: string;
    decidedByUserId: string;
    decisionNote?: string | null;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.scheduleChangeRequest.findUnique({
        where: { id: input.scheduleChangeRequestId },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          proposedPickupWindowStart: true,
          proposedPickupWindowEnd: true,
          proposedDropoffWindowStart: true,
          proposedDropoffWindowEnd: true,
          requestedByUserId: true,
          requestedByRole: true,
          reason: true,
          delivery: {
            select: {
              id: true,
              status: true,
              pickupWindowStart: true,
              pickupWindowEnd: true,
              dropoffWindowStart: true,
              dropoffWindowEnd: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException("Schedule change request not found");
      }

      if (request.status !== EnumScheduleChangeRequestStatus.PENDING) {
        throw new BadRequestException(
          "Only PENDING schedule change requests can be approved"
        );
      }

      this.assertDeliveryAllowsScheduleChange(request.delivery.status);
      this.validateRequestedWindows({
        currentPickupWindowStart: request.delivery.pickupWindowStart,
        currentPickupWindowEnd: request.delivery.pickupWindowEnd,
        currentDropoffWindowStart: request.delivery.dropoffWindowStart,
        currentDropoffWindowEnd: request.delivery.dropoffWindowEnd,
        proposedPickupWindowStart: request.proposedPickupWindowStart,
        proposedPickupWindowEnd: request.proposedPickupWindowEnd,
        proposedDropoffWindowStart: request.proposedDropoffWindowStart,
        proposedDropoffWindowEnd: request.proposedDropoffWindowEnd,
      });

      const nextPickupWindowStart =
        request.proposedPickupWindowStart ?? request.delivery.pickupWindowStart;
      const nextPickupWindowEnd =
        request.proposedPickupWindowEnd ?? request.delivery.pickupWindowEnd;
      const nextDropoffWindowStart =
        request.proposedDropoffWindowStart ?? request.delivery.dropoffWindowStart;
      const nextDropoffWindowEnd =
        request.proposedDropoffWindowEnd ?? request.delivery.dropoffWindowEnd;

      await tx.deliveryRequest.update({
        where: { id: request.deliveryId },
        data: {
          pickupWindowStart: nextPickupWindowStart,
          pickupWindowEnd: nextPickupWindowEnd,
          dropoffWindowStart: nextDropoffWindowStart,
          dropoffWindowEnd: nextDropoffWindowEnd,
        },
      });

      const updatedRequest = await tx.scheduleChangeRequest.update({
        where: { id: request.id },
        data: {
          status: EnumScheduleChangeRequestStatus.APPROVED,
          decidedAt: new Date(),
          decidedByUserId: input.decidedByUserId,
          decisionNote: this.trimOrNull(input.decisionNote),
        },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          decidedAt: true,
          decidedByUserId: true,
          requestedByUserId: true,
        },
      });

      await this.createDeliveryStatusHistoryNote(
        tx,
        request.deliveryId,
        request.delivery.status,
        `Schedule change approved${
          input.decisionNote ? `: ${this.trimOrNull(input.decisionNote)}` : ""
        }`,
        input.decidedByUserId,
        EnumDeliveryStatusHistoryActorRole.ADMIN
      );

      return {
        updatedRequest,
        notify: {
          outcome: "APPROVED" as ScheduleDecisionOutcome,
          deliveryId: request.deliveryId,
          requestedByUserId: request.requestedByUserId ?? null,
          decisionNote: this.trimOrNull(input.decisionNote),
        },
      };
    });

    await this.notificationEventEngine.notifyScheduleChangeDecided({
      deliveryId: result.notify.deliveryId,
      actorUserId: input.decidedByUserId,
      outcome: result.notify.outcome,
      decisionNote: result.notify.decisionNote,
      requestedByUserId: result.notify.requestedByUserId,
    });

    return result.updatedRequest;
  }

  async declineScheduleChange(input: {
    scheduleChangeRequestId: string;
    decidedByUserId: string;
    decisionNote?: string | null;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.scheduleChangeRequest.findUnique({
        where: { id: input.scheduleChangeRequestId },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          requestedByUserId: true,
          delivery: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException("Schedule change request not found");
      }

      if (request.status !== EnumScheduleChangeRequestStatus.PENDING) {
        throw new BadRequestException(
          "Only PENDING schedule change requests can be declined"
        );
      }

      const updated = await tx.scheduleChangeRequest.update({
        where: { id: request.id },
        data: {
          status: EnumScheduleChangeRequestStatus.DECLINED,
          decidedAt: new Date(),
          decidedByUserId: input.decidedByUserId,
          decisionNote: this.trimOrNull(input.decisionNote),
        },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          decidedAt: true,
          decidedByUserId: true,
          requestedByUserId: true,
        },
      });

      await this.createDeliveryStatusHistoryNote(
        tx,
        request.deliveryId,
        request.delivery.status,
        `Schedule change declined${
          input.decisionNote ? `: ${this.trimOrNull(input.decisionNote)}` : ""
        }`,
        input.decidedByUserId,
        EnumDeliveryStatusHistoryActorRole.ADMIN
      );

      return {
        updatedRequest: updated,
        notify: {
          outcome: "DECLINED" as ScheduleDecisionOutcome,
          deliveryId: request.deliveryId,
          requestedByUserId: request.requestedByUserId ?? null,
          decisionNote: this.trimOrNull(input.decisionNote),
        },
      };
    });

    await this.notificationEventEngine.notifyScheduleChangeDecided({
      deliveryId: result.notify.deliveryId,
      actorUserId: input.decidedByUserId,
      outcome: result.notify.outcome,
      decisionNote: result.notify.decisionNote,
      requestedByUserId: result.notify.requestedByUserId,
    });

    return result.updatedRequest;
  }

  async cancelScheduleChange(input: {
    scheduleChangeRequestId: string;
    actorUserId?: string | null;
    actorRole?: EnumScheduleChangeRequestRequestedByRole | null;
    note?: string | null;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.scheduleChangeRequest.findUnique({
        where: { id: input.scheduleChangeRequestId },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          requestedByUserId: true,
          requestedByRole: true,
          delivery: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException("Schedule change request not found");
      }

      if (request.status !== EnumScheduleChangeRequestStatus.PENDING) {
        throw new BadRequestException(
          "Only PENDING schedule change requests can be cancelled"
        );
      }

      const updated = await tx.scheduleChangeRequest.update({
        where: { id: request.id },
        data: {
          status: EnumScheduleChangeRequestStatus.CANCELLED,
        },
        select: {
          id: true,
          deliveryId: true,
          status: true,
          requestedByUserId: true,
        },
      });

      await this.createDeliveryStatusHistoryNote(
        tx,
        request.deliveryId,
        request.delivery.status,
        `Schedule change cancelled${
          input.note ? `: ${this.trimOrNull(input.note)}` : ""
        }`,
        input.actorUserId ?? null,
        this.mapScheduleRequestedByRoleToDeliveryActorRole(
          input.actorRole ?? request.requestedByRole ?? null
        )
      );

      return {
        updatedRequest: updated,
        notify: {
          outcome: "CANCELLED" as ScheduleDecisionOutcome,
          deliveryId: request.deliveryId,
          requestedByUserId: request.requestedByUserId ?? null,
          decisionNote: this.trimOrNull(input.note),
        },
      };
    });

    await this.notificationEventEngine.notifyScheduleChangeDecided({
      deliveryId: result.notify.deliveryId,
      actorUserId: input.actorUserId ?? null,
      outcome: result.notify.outcome,
      decisionNote: result.notify.decisionNote,
      requestedByUserId: result.notify.requestedByUserId,
    });

    return result.updatedRequest;
  }

  private async getDeliveryOrThrow(deliveryId: string, db: Tx) {
    const delivery = await db.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        dropoffWindowStart: true,
        dropoffWindowEnd: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    return delivery;
  }

  private assertDeliveryAllowsScheduleChange(status: EnumDeliveryRequestStatus) {
    if (
      status === EnumDeliveryRequestStatus.COMPLETED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new BadRequestException(
        "Schedule changes are not allowed in the current delivery status"
      );
    }
  }

  private validateRequestedWindows(input: {
    currentPickupWindowStart?: Date | null;
    currentPickupWindowEnd?: Date | null;
    currentDropoffWindowStart?: Date | null;
    currentDropoffWindowEnd?: Date | null;
    proposedPickupWindowStart?: Date | null;
    proposedPickupWindowEnd?: Date | null;
    proposedDropoffWindowStart?: Date | null;
    proposedDropoffWindowEnd?: Date | null;
  }) {
    const hasPickup =
      !!input.proposedPickupWindowStart || !!input.proposedPickupWindowEnd;
    const hasDropoff =
      !!input.proposedDropoffWindowStart || !!input.proposedDropoffWindowEnd;

    if (!hasPickup && !hasDropoff) {
      throw new BadRequestException(
        "At least one proposed schedule window is required"
      );
    }

    this.validateDateRange(
      input.proposedPickupWindowStart,
      input.proposedPickupWindowEnd,
      "proposed pickup window"
    );

    this.validateDateRange(
      input.proposedDropoffWindowStart,
      input.proposedDropoffWindowEnd,
      "proposed dropoff window"
    );

    const nextPickupStart =
      input.proposedPickupWindowStart ?? input.currentPickupWindowStart ?? null;
    const nextPickupEnd =
      input.proposedPickupWindowEnd ?? input.currentPickupWindowEnd ?? null;
    const nextDropoffStart =
      input.proposedDropoffWindowStart ?? input.currentDropoffWindowStart ?? null;
    const nextDropoffEnd =
      input.proposedDropoffWindowEnd ?? input.currentDropoffWindowEnd ?? null;

    if (
      nextPickupStart &&
      nextPickupEnd &&
      nextDropoffStart &&
      nextDropoffEnd &&
      nextDropoffEnd <= nextPickupStart
    ) {
      throw new BadRequestException(
        "Dropoff window must occur after pickup window"
      );
    }
  }

  private validateDateRange(
    start?: Date | null,
    end?: Date | null,
    label?: string
  ) {
    if ((start && !end) || (!start && end)) {
      throw new BadRequestException(
        `${label} start and end must both be provided together`
      );
    }

    if (!start && !end) {
      return;
    }

    const startDate = new Date(start as Date);
    const endDate = new Date(end as Date);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(`${label} is invalid`);
    }

    if (endDate <= startDate) {
      throw new BadRequestException(`${label} end must be after start`);
    }
  }

  private async createDeliveryStatusHistoryNote(
    tx: Tx,
    deliveryId: string,
    currentStatus: EnumDeliveryRequestStatus,
    note: string,
    actorUserId?: string | null,
    actorRole?: EnumDeliveryStatusHistoryActorRole | null
  ) {
    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId,
        actorUserId: actorUserId ?? null,
        actorRole: actorRole ?? null,
        actorType: EnumDeliveryStatusHistoryActorType.USER,
        note,
        fromStatus:
          currentStatus as unknown as EnumDeliveryStatusHistoryFromStatus,
        toStatus: currentStatus as unknown as EnumDeliveryStatusHistoryToStatus,
      },
    });
  }

  private mapScheduleRequestedByRoleToDeliveryActorRole(
    role: EnumScheduleChangeRequestRequestedByRole | null
  ): EnumDeliveryStatusHistoryActorRole | null {
    if (!role) return null;

    const map: Record<
      EnumScheduleChangeRequestRequestedByRole,
      EnumDeliveryStatusHistoryActorRole
    > = {
      PRIVATE_CUSTOMER: EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER,
      BUSINESS_CUSTOMER: EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER,
      DRIVER: EnumDeliveryStatusHistoryActorRole.DRIVER,
      ADMIN: EnumDeliveryStatusHistoryActorRole.ADMIN,
    };

    return map[role] ?? null;
  }

  private trimOrNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
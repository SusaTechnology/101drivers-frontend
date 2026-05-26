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
  EnumDriverPayoutStatus,
  EnumPaymentEventType,
  EnumPaymentStatus,
  EnumTrackingSessionStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DeliveryCancellationEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine
  ) {}

  async cancelDelivery(input: {
    deliveryId: string;
    actorUserId?: string | null;
    actorRole?: EnumDeliveryStatusHistoryActorRole | null;
    note?: string | null;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRequest.findUnique({
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
        },
      });

      if (!delivery) {
        throw new NotFoundException("Delivery request not found");
      }

      this.assertActorCanCancel({
        status: delivery.status,
        actorRole: input.actorRole ?? null,
      });

      this.assertStatusCanCancel(delivery.status);

      const now = new Date();
      const activeAssignment = delivery.assignments?.[0] ?? null;

      if (activeAssignment) {
        await tx.deliveryAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            unassignedAt: now,
            reason: this.buildUnassignReason(input.note),
          },
        });
      }

      if (delivery.trackingSession?.id) {
        await tx.trackingSession.update({
          where: { id: delivery.trackingSession.id },
          data: {
            stoppedAt: now,
            status: EnumTrackingSessionStatus.STOPPED,
          },
        });
      }

      if (delivery.payout?.id) {
        if (
          delivery.payout.status !== EnumDriverPayoutStatus.PAID &&
          delivery.payout.status !== EnumDriverPayoutStatus.CANCELLED
        ) {
          await tx.driverPayout.update({
            where: { id: delivery.payout.id },
            data: {
              status: EnumDriverPayoutStatus.CANCELLED,
              failureMessage: "Delivery cancelled before payout completion",
            },
          });
        }
      }

      if (delivery.payment?.id) {
        if (delivery.payment.status === EnumPaymentStatus.AUTHORIZED) {
          await tx.payment.update({
            where: { id: delivery.payment.id },
            data: {
              status: EnumPaymentStatus.VOIDED,
              voidedAt: now,
            },
          });

          await tx.paymentEvent.create({
            data: {
              paymentId: delivery.payment.id,
              type: EnumPaymentEventType.VOID,
              status: EnumPaymentStatus.VOIDED,
              message: "Payment voided because delivery was cancelled",
            },
          });
        }
      }

      await tx.deliveryRequest.update({
        where: { id: delivery.id },
        data: {
          status: EnumDeliveryRequestStatus.CANCELLED,
        },
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          actorType: EnumDeliveryStatusHistoryActorType.USER,
          note: this.trimOrNull(input.note) ?? "Delivery cancelled",
          fromStatus:
            delivery.status as unknown as EnumDeliveryStatusHistoryFromStatus,
          toStatus:
            EnumDeliveryRequestStatus.CANCELLED as unknown as EnumDeliveryStatusHistoryToStatus,
        },
      });

      return {
        deliveryId: delivery.id,
        customerId: delivery.customerId,
        driverId: activeAssignment?.driverId ?? null,
      };
    });

    await this.notificationEventEngine.notifyDeliveryCancelled({
      deliveryId: result.deliveryId,
      actorUserId: input.actorUserId ?? null,
      driverId: result.driverId,
    });

    return result;
  }

  private assertActorCanCancel(input: {
    status: EnumDeliveryRequestStatus;
    actorRole?: EnumDeliveryStatusHistoryActorRole | null;
  }) {
    const role = input.actorRole;

    if (!role) {
      throw new BadRequestException("actorRole is required");
    }

    if (role === EnumDeliveryStatusHistoryActorRole.DRIVER) {
      throw new BadRequestException(
        "Drivers cannot cancel deliveries in-app; contact Operations/Admin"
      );
    }

    if (
      role !== EnumDeliveryStatusHistoryActorRole.ADMIN &&
      role !== EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER &&
      role !== EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER
    ) {
      throw new BadRequestException(`Unsupported actorRole: ${role}`);
    }
  }

  private assertStatusCanCancel(status: EnumDeliveryRequestStatus) {
    if (
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.COMPLETED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Delivery in status ${status} cannot be cancelled`
      );
    }

    if (status === EnumDeliveryRequestStatus.ACTIVE) {
      throw new BadRequestException(
        "ACTIVE deliveries cannot be directly cancelled; use dispute/admin override flow"
      );
    }
  }

  private buildUnassignReason(note?: string | null): string {
    const trimmed = this.trimOrNull(note);
    return trimmed
      ? `Delivery cancelled: ${trimmed}`
      : "Delivery cancelled";
  }

  private trimOrNull(value?: string | null): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
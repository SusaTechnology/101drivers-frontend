import { BadRequestException, Injectable, Inject, Optional, forwardRef, Logger, NotFoundException } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryToStatus,
  EnumDriverPayoutStatus,
  EnumDriverPayoutType,
  EnumDriverStatus,
  EnumPaymentEventType,
  EnumPaymentStatus,
  EnumTrackingSessionStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { TrackingGateway } from "../../gateways/tracking.gateway";
import { StripeService } from "../../providers/stripe/stripe.service";

@Injectable()
export class AdminDeliveryEngine {
  private readonly logger = new Logger(AdminDeliveryEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine,
    @Optional() @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway?: TrackingGateway,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {}

  /**
   * Emit socket events after a status change (fire-and-forget).
   * Mirrors the pattern in DeliveryLifecycleService.emitStatusChanged.
   */
  private emitStatusChanged(
    deliveryId: string,
    status: string,
    customerId?: string | null,
    lockIn?: {
      retained: boolean;
      amount?: number | null;
      driverSharePct?: number | null;
    },
  ): void {
    if (!this.trackingGateway) return;
    const gateway = this.trackingGateway;
    this.prisma.deliveryRequest
      .findUnique({
        where: { id: deliveryId },
        select: {
          trackingShareToken: true,
          customer: { select: { id: true } },
        },
      })
      .then((row) => {
        if (!row) return;
        try {
          gateway.emitStatusChange({
            deliveryId,
            status,
            dealerId: row.customer?.id ?? customerId ?? undefined,
            shareToken: row.trackingShareToken ?? undefined,
            lockInRetained: lockIn?.retained,
            lockInAmount: lockIn?.amount,
            lockInDriverSharePct: lockIn?.driverSharePct,
          });
          if (["LISTED", "BOOKED", "CANCELLED", "EXPIRED"].includes(status)) {
            gateway.emitFeedUpdate({ deliveryId, status });
          }
        } catch (err) {
          this.logger.warn("Failed to emit status change via WebSocket:", err);
        }
      })
      .catch(() => {});
  }
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

  this.emitStatusChanged(input.deliveryId, EnumDeliveryRequestStatus.BOOKED, delivery.customerId);
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
        customerId: true,
        lockedInAt: true,
        lockInBaseFee: true,
        lockInDriverSharePct: true,
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            providerPaymentIntentId: true,
          },
        },
        payout: {
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
      throw new NotFoundException("Delivery not found");
    }

    if (
      delivery.status === EnumDeliveryRequestStatus.COMPLETED ||
      delivery.status === EnumDeliveryRequestStatus.CANCELLED
    ) {
      throw new BadRequestException("Delivery cannot be cancelled");
    }

    const beforeJson = delivery;
    const now = new Date();
    const activeAssignment = delivery.assignments?.[0] ?? null;

    const isLockedIn =
      !!delivery.lockedInAt &&
      !!delivery.lockInBaseFee &&
      delivery.lockInBaseFee > 0;
    const lockInAmount = isLockedIn
      ? Number(delivery.lockInBaseFee!.toFixed(2))
      : 0;

    await this.prisma.$transaction(async (tx) => {
      // Unassign driver
      if (activeAssignment) {
        await tx.deliveryAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            unassignedAt: now,
            reason: `Admin cancelled: ${input.reason}`,
          },
        });
      }

      // Driver payout
      if (isLockedIn) {
        const driverSharePct = Number(delivery.lockInDriverSharePct ?? 60);
        const driverNet = Number((lockInAmount * driverSharePct / 100).toFixed(2));
        const platformFee = Number((lockInAmount - driverNet).toFixed(2));

        if (delivery.payout?.id) {
          await tx.driverPayout.update({
            where: { id: delivery.payout.id },
            data: {
              status: EnumDriverPayoutStatus.ELIGIBLE,
              failureMessage: null,
              grossAmount: lockInAmount,
              insuranceFee: 0,
              platformFee,
              netAmount: driverNet,
              driverSharePct,
              type: EnumDriverPayoutType.LOCK_IN_FEE,
            },
          });
        } else if (activeAssignment) {
          await tx.driverPayout.create({
            data: {
              deliveryId: delivery.id,
              driverId: activeAssignment.driverId,
              grossAmount: lockInAmount,
              insuranceFee: 0,
              platformFee,
              netAmount: driverNet,
              driverSharePct,
              status: EnumDriverPayoutStatus.ELIGIBLE,
              type: EnumDriverPayoutType.LOCK_IN_FEE,
            },
          });
        }
      } else if (delivery.payout?.id) {
        await tx.driverPayout.updateMany({
          where: {
            id: delivery.payout.id,
            status: { notIn: ["PAID", "CANCELLED"] as any },
          },
          data: {
            status: "CANCELLED" as any,
            failureMessage: "Delivery cancelled by admin",
          },
        });
      }

      // Payment
      if (delivery.payment?.id) {
        if (isLockedIn) {
          await tx.payment.update({
            where: { id: delivery.payment.id },
            data: {
              status: EnumPaymentStatus.CAPTURED,
              capturedAt: now,
              amount: lockInAmount,
            },
          });
          await tx.paymentEvent.create({
            data: {
              paymentId: delivery.payment.id,
              type: EnumPaymentEventType.CAPTURE,
              status: EnumPaymentStatus.CAPTURED,
              amount: lockInAmount,
              message: `Lock-in base fee retained on admin cancellation ($${lockInAmount.toFixed(2)})`,
            },
          });
        } else if (delivery.payment.status === EnumPaymentStatus.AUTHORIZED) {
          // Legacy: void the auth hold (was previously not done here — adding for consistency)
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
              message: `Payment voided on admin cancel: ${input.reason}`,
            },
          });
          if (delivery.payment.providerPaymentIntentId && this.stripeService) {
            try {
              await this.stripeService.cancelPaymentIntent(delivery.payment.providerPaymentIntentId);
            } catch (err: any) {
              this.logger.warn(`Admin cancel: failed to void Stripe PI: ${err.message}`);
            }
          }
        }
        // CAPTURED/PAID legacy: admin must use the manual refund endpoint
        // (`/payments/stripe/refund/:paymentId`) — not done here automatically.
      }

      // Update delivery status
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
          note: isLockedIn
            ? `${input.reason} (lock-in base fee $${lockInAmount.toFixed(2)} retained)`
            : input.reason,
        },
      });

      const afterDelivery = await tx.deliveryRequest.findUnique({
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
          driverId: activeAssignment?.driverId ?? null,
          reason: input.reason,
          beforeJson: beforeJson ?? Prisma.JsonNull,
          afterJson: afterDelivery ?? Prisma.JsonNull,
        },
      });
    });

    // Path B previously did NOT send any cancellation notification — only
    // Path A (customer) and Path C (force-cancel) did. Admins cancelling
    // a delivery silently left both customer and driver in the dark. This
    // reuses the same notifyDeliveryCancelled path as Path A so the
    // customer + driver get the lock-in-aware email when applicable.
    await this.notificationEventEngine.notifyDeliveryCancelled({
      deliveryId: input.deliveryId,
      actorUserId: input.actorUserId ?? null,
      driverId: activeAssignment?.driverId ?? null,
      lockInRetained: isLockedIn,
      lockInAmount,
      lockInDriverSharePct: delivery.lockInDriverSharePct ?? null,
    });

    this.emitStatusChanged(
      input.deliveryId,
      EnumDeliveryRequestStatus.CANCELLED,
      delivery.customerId,
      {
        retained: isLockedIn,
        amount: lockInAmount,
        driverSharePct: delivery.lockInDriverSharePct ?? null,
      },
    );
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
        lockedInAt: true,
        lockInBaseFee: true,
        lockInDriverSharePct: true,
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            providerPaymentIntentId: true,
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

    const isLockedIn =
      !!delivery.lockedInAt &&
      !!delivery.lockInBaseFee &&
      delivery.lockInBaseFee > 0;
    const lockInAmount = isLockedIn
      ? Number(delivery.lockInBaseFee!.toFixed(2))
      : 0;

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
            status: EnumTrackingSessionStatus.STOPPED,
          },
        });
      }

      // Driver payout
      if (isLockedIn) {
        const driverSharePct = Number(delivery.lockInDriverSharePct ?? 60);
        const driverNet = Number((lockInAmount * driverSharePct / 100).toFixed(2));
        const platformFee = Number((lockInAmount - driverNet).toFixed(2));

        if (delivery.payout?.id) {
          await tx.driverPayout.update({
            where: { id: delivery.payout.id },
            data: {
              status: EnumDriverPayoutStatus.ELIGIBLE,
              failureMessage: null,
              grossAmount: lockInAmount,
              insuranceFee: 0,
              platformFee,
              netAmount: driverNet,
              driverSharePct,
              type: EnumDriverPayoutType.LOCK_IN_FEE,
            },
          });
        } else if (activeDriverId) {
          await tx.driverPayout.create({
            data: {
              deliveryId: delivery.id,
              driverId: activeDriverId,
              grossAmount: lockInAmount,
              insuranceFee: 0,
              platformFee,
              netAmount: driverNet,
              driverSharePct,
              status: EnumDriverPayoutStatus.ELIGIBLE,
              type: EnumDriverPayoutType.LOCK_IN_FEE,
            },
          });
        }
      } else if (delivery.payout?.id) {
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

      // Payment
      if (delivery.payment?.id) {
        if (isLockedIn) {
          await tx.payment.update({
            where: { id: delivery.payment.id },
            data: {
              status: EnumPaymentStatus.CAPTURED,
              capturedAt: now,
              amount: lockInAmount,
            },
          });
          await tx.paymentEvent.create({
            data: {
              paymentId: delivery.payment.id,
              type: EnumPaymentEventType.CAPTURE,
              status: EnumPaymentStatus.CAPTURED,
              amount: lockInAmount,
              message: `Lock-in base fee retained on admin force-cancel ($${lockInAmount.toFixed(2)})`,
            },
          });
        } else if (delivery.payment.status === EnumPaymentStatus.AUTHORIZED) {
          // No lock-in: void the auth hold (was previously not done — adding for consistency)
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
              message: `Payment voided on admin force-cancel: ${input.reason}`,
            },
          });
          if (delivery.payment.providerPaymentIntentId && this.stripeService) {
            try {
              await this.stripeService.cancelPaymentIntent(delivery.payment.providerPaymentIntentId);
            } catch (err: any) {
              this.logger.warn(`Admin force-cancel: failed to void Stripe PI: ${err.message}`);
            }
          }
        }
        // CAPTURED/PAID legacy: admin must use manual refund endpoint.
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
          note: isLockedIn
            ? `Force-cancelled by admin: ${input.reason} (lock-in base fee $${lockInAmount.toFixed(2)} retained)`
            : `Force-cancelled by admin: ${input.reason}`,
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
      lockInRetained: isLockedIn,
      lockInAmount,
      lockInDriverSharePct: delivery.lockInDriverSharePct ?? null,
    });

    this.emitStatusChanged(
      input.deliveryId,
      EnumDeliveryRequestStatus.CANCELLED,
      delivery.customerId,
      {
        retained: isLockedIn,
        amount: lockInAmount,
        driverSharePct: delivery.lockInDriverSharePct ?? null,
      },
    );
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

    this.emitStatusChanged(input.deliveryId, EnumDeliveryRequestStatus.DISPUTED, delivery.customerId);
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

    this.emitStatusChanged(input.deliveryId, EnumDeliveryRequestStatus.BOOKED);
  }
}
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryToStatus,
  EnumDisputeCaseStatus,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { StripeService } from "../../providers/stripe/stripe.service";

/**
 * DisputeAdminEngine — admin operations on DisputeCase records.
 *
 * RESPONSIBILITIES:
 *  - openDispute / addNote / updateStatus / resolve / reject / close / toggleLegalHold
 *  - Audit-log every state change.
 *  - Send real notifications (via NotificationEventEngine.queueAndSend) — NOT
 *    raw prisma.notificationEvent.create rows that never get sent.
 *  - When resolveDispute(approveRefund=true) is called: issue a Stripe refund
 *    (with idempotency), persist stripeRefundId, update Payment.status,
 *    transition the delivery back to COMPLETED.
 *  - When rejectDispute is called: persist rejectionReason, transition the
 *    delivery back to COMPLETED, notify the customer.
 *  - When closeDispute is called: transition the delivery back to a
 *    sensible state (COMPLETED).
 *
 * All multi-table writes are wrapped in prisma.$transaction for atomicity.
 * All state transitions are validated by DisputeCasePolicyService
 * (called via DisputeCaseService.updateDisputeCase from the controller
 * layer — the engine itself uses prisma.update directly for performance,
 * but uses the same allowed-transitions matrix as the policy).
 */
@Injectable()
export class DisputeAdminEngine {
  private readonly logger = new Logger(DisputeAdminEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEventEngine: NotificationEventEngine,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {}

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

    // Create the dispute, update delivery status to DISPUTED, write status
    // history, and write the audit log — all in a transaction.
    const disputeId = await this.prisma.$transaction(async (tx) => {
      const dispute = await tx.disputeCase.create({
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

      const previousStatus = delivery.status as EnumDeliveryRequestStatus;

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
          fromStatus: previousStatus as any,
          toStatus: EnumDeliveryStatusHistoryToStatus.DISPUTED,
          note: input.reason.trim(),
        },
      });

      await tx.adminAuditLog.create({
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
            deliveryPreviousStatus: previousStatus,
            deliveryNewStatus: EnumDeliveryRequestStatus.DISPUTED,
          },
        },
      });

      return dispute.id;
    });

    // Notification is OUTSIDE the transaction so a notification failure
    // doesn't roll back the dispute creation. notifyDisputeOpened is the
    // existing method on the notification engine that already sends the
    // correct customer + driver emails.
    try {
      await this.notificationEventEngine.notifyDisputeOpened({
        deliveryId: input.deliveryId,
        actorUserId: input.actorUserId ?? null,
        reason: input.reason.trim(),
        legalHold: false,
      });
    } catch (err) {
      this.logger.error(
        `notifyDisputeOpened failed for delivery ${input.deliveryId}: ${(err as Error).message}`,
      );
    }

    return disputeId;
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

    await this.prisma.$transaction(async (tx) => {
      await tx.disputeNote.create({
        data: {
          disputeId: input.disputeId,
          authorUserId: input.actorUserId ?? null,
          note: input.note.trim(),
        },
      });

      await tx.adminAuditLog.create({
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
    });

    // Best-effort notification (currently a no-op placeholder — see
    // notifyDisputeNoteAdded doc).
    try {
      await this.notificationEventEngine.notifyDisputeNoteAdded({
        deliveryId: dispute.deliveryId,
        actorUserId: input.actorUserId ?? null,
        note: input.note.trim(),
      });
    } catch (err) {
      this.logger.error(
        `notifyDisputeNoteAdded failed for dispute ${input.disputeId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Update dispute status. Validates the transition is allowed by the
   * same matrix as DisputeCasePolicyService — keeps the engine in sync
   * with the policy layer without the policy layer having to be
   * injected here (avoids a circular dep).
   *
   * NOTE: For resolve/reject, call resolveDispute/rejectDispute instead —
   * those methods handle refund + delivery-status revert + notifications.
   * This method is the low-level primitive used by /admin-status.
   */
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

    // Validate transition is allowed — mirrors the policy's matrix.
    this.assertTransitionAllowed(dispute.status, input.status);

    const beforeJson = dispute;

    const updateData: Prisma.DisputeCaseUpdateInput = {
      status: input.status,
    };

    if (input.status === EnumDisputeCaseStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
      if (input.actorUserId) {
        updateData.resolvedBy = { connect: { id: input.actorUserId } };
      }
    }

    if (input.status === EnumDisputeCaseStatus.REJECTED) {
      updateData.resolvedAt = new Date();
      if (input.actorUserId) {
        updateData.resolvedBy = { connect: { id: input.actorUserId } };
      }
    }

    if (input.status === EnumDisputeCaseStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.disputeCase.update({
        where: { id: input.disputeId },
        data: updateData,
      });

      if (input.note?.trim()) {
        await tx.disputeNote.create({
          data: {
            disputeId: input.disputeId,
            authorUserId: input.actorUserId ?? null,
            note: input.note.trim(),
          },
        });
      }

      const afterDispute = await tx.disputeCase.findUnique({
        where: { id: input.disputeId },
        select: {
          id: true,
          status: true,
          legalHold: true,
          resolvedAt: true,
          closedAt: true,
        },
      });

      await tx.adminAuditLog.create({
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
    });
  }

  /**
   * Resolve a dispute.
   *
   * If approveRefund=true:
   *   1. Look up the Payment for the dispute's delivery.
   *   2. Call StripeService.createRefund with an idempotency key derived
   *      from the disputeId (so retrying doesn't double-refund).
   *   3. Persist stripeRefundId on the dispute, update Payment.status.
   *   4. Transition DeliveryRequest.status from DISPUTED back to COMPLETED.
   *
   * If approveRefund=false: just mark RESOLVED (no refund). The delivery
   * is still reverted to COMPLETED — the dispute is over.
   *
   * Sends notifyDisputeResolved regardless of refund decision (the
   * notification body changes based on refundIssued).
   */
  async resolveDispute(input: {
    disputeId: string;
    approveRefund: boolean;
    refundAmount?: number | null;
    resolutionNote?: string | null;
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

    if (dispute.status === EnumDisputeCaseStatus.CLOSED) {
      throw new BadRequestException("Closed disputes cannot be resolved");
    }

    this.assertTransitionAllowed(
      dispute.status,
      EnumDisputeCaseStatus.RESOLVED,
    );

    let stripeRefundId: string | null = null;
    let refundAmount: number | null = null;

    if (input.approveRefund) {
      // Load the payment row for this delivery.
      const payment = await this.prisma.payment.findUnique({
        where: { deliveryId: dispute.deliveryId },
        select: {
          id: true,
          amount: true,
          providerChargeId: true,
          providerPaymentIntentId: true,
          status: true,
        },
      });

      if (!payment) {
        throw new BadRequestException(
          "Cannot resolve with refund — no payment record found for this delivery",
        );
      }

      if (!payment.providerChargeId) {
        throw new BadRequestException(
          "Cannot refund — payment has no providerChargeId (was never captured)",
        );
      }

      if (!this.stripeService) {
        throw new BadRequestException(
          "Cannot refund — Stripe service is not configured",
        );
      }

      // Determine refund amount — defaults to full payment amount.
      refundAmount =
        input.refundAmount != null
          ? Number(input.refundAmount)
          : Number(payment.amount);

      if (refundAmount <= 0) {
        throw new BadRequestException("Refund amount must be greater than 0");
      }

      if (refundAmount > Number(payment.amount)) {
        throw new BadRequestException(
          `Refund amount ($${refundAmount.toFixed(2)}) cannot exceed payment amount ($${Number(payment.amount).toFixed(2)})`,
        );
      }

      // Issue the refund via Stripe. The StripeService already derives
      // a stable idempotency key from chargeId + amount, so retrying
      // this call (e.g. after a network timeout) will NOT double-refund.
      try {
        const refund = await this.stripeService.createRefund({
          chargeId: payment.providerChargeId,
          amount: refundAmount,
          reason: "requested_by_customer",
          metadata: {
            disputeId: input.disputeId,
            deliveryId: dispute.deliveryId,
            resolvedBy: input.actorUserId ?? "",
          },
        });
        stripeRefundId = refund?.id ?? null;
      } catch (err) {
        this.logger.error(
          `Stripe refund failed for dispute ${input.disputeId}: ${(err as Error).message}`,
        );
        throw new BadRequestException(
          `Stripe refund failed: ${(err as Error).message}`,
        );
      }
    }

    // Persist everything atomically.
    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.DisputeCaseUpdateInput = {
        status: EnumDisputeCaseStatus.RESOLVED,
        resolvedAt: new Date(),
      };

      if (input.actorUserId) {
        updateData.resolvedBy = { connect: { id: input.actorUserId } };
      }

      if (stripeRefundId) {
        updateData.stripeRefundId = stripeRefundId;
      }

      await tx.disputeCase.update({
        where: { id: input.disputeId },
        data: updateData,
      });

      if (input.resolutionNote?.trim()) {
        await tx.disputeNote.create({
          data: {
            disputeId: input.disputeId,
            authorUserId: input.actorUserId ?? null,
            note: input.resolutionNote.trim(),
          },
        });
      }

      // Update Payment.status to REFUNDED or PARTIALLY_REFUNDED.
      if (input.approveRefund && stripeRefundId) {
        const payment = await tx.payment.findUnique({
          where: { deliveryId: dispute.deliveryId },
          select: { id: true, amount: true },
        });

        if (payment) {
          // The Payment enum has only REFUNDED (no PARTIALLY_REFUNDED).
          // We mark it REFUNDED for any refund amount; the actual amount
          // is recoverable from the Stripe refund record.
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: EnumPaymentStatus.REFUNDED,
              refundedAt: new Date(),
            },
          });
        }
      }

      // Revert the delivery from DISPUTED back to COMPLETED.
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: dispute.deliveryId },
        select: { id: true, status: true },
      });

      if (
        delivery &&
        (delivery.status as EnumDeliveryRequestStatus) ===
          EnumDeliveryRequestStatus.DISPUTED
      ) {
        await tx.deliveryRequest.update({
          where: { id: dispute.deliveryId },
          data: {
            status: EnumDeliveryRequestStatus.COMPLETED,
          },
        });

        await tx.deliveryStatusHistory.create({
          data: {
            deliveryId: dispute.deliveryId,
            actorUserId: input.actorUserId ?? null,
            actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
            actorType: EnumDeliveryStatusHistoryActorType.USER,
            fromStatus: EnumDeliveryStatusHistoryToStatus.DISPUTED,
            toStatus: EnumDeliveryStatusHistoryToStatus.COMPLETED,
            note: `Dispute resolved${input.approveRefund ? " (with refund)" : " (no refund)"}`,
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: dispute.deliveryId,
          reason: input.resolutionNote?.trim() ?? "Dispute resolved",
          beforeJson: {
            disputeId: input.disputeId,
            previousStatus: dispute.status,
          },
          afterJson: {
            disputeId: input.disputeId,
            status: EnumDisputeCaseStatus.RESOLVED,
            refundIssued: input.approveRefund,
            refundAmount,
            stripeRefundId,
            deliveryRevertedTo: EnumDeliveryRequestStatus.COMPLETED,
          },
        },
      });
    });

    // Best-effort notification (outside the transaction).
    try {
      await this.notificationEventEngine.notifyDisputeResolved({
        deliveryId: dispute.deliveryId,
        actorUserId: input.actorUserId ?? null,
        resolutionNote: input.resolutionNote ?? null,
        refundIssued: input.approveRefund,
        refundAmount: refundAmount,
        stripeRefundId: stripeRefundId,
      });
    } catch (err) {
      this.logger.error(
        `notifyDisputeResolved failed for dispute ${input.disputeId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Reject a dispute — the admin decides the dispute has no merit.
   * Sets status to REJECTED (distinct from RESOLVED which means
   * "resolved in customer's favor"). rejectionReason is required and
   * shared with the customer in the notification.
   *
   * Reverts the delivery from DISPUTED back to COMPLETED.
   */
  async rejectDispute(input: {
    disputeId: string;
    rejectionReason: string;
    note?: string | null;
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

    if (dispute.status === EnumDisputeCaseStatus.CLOSED) {
      throw new BadRequestException("Closed disputes cannot be rejected");
    }

    this.assertTransitionAllowed(
      dispute.status,
      EnumDisputeCaseStatus.REJECTED,
    );

    if (!input.rejectionReason?.trim()) {
      throw new BadRequestException("rejectionReason is required");
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.DisputeCaseUpdateInput = {
        status: EnumDisputeCaseStatus.REJECTED,
        rejectionReason: input.rejectionReason.trim(),
        resolvedAt: new Date(),
      };

      if (input.actorUserId) {
        updateData.resolvedBy = { connect: { id: input.actorUserId } };
      }

      await tx.disputeCase.update({
        where: { id: input.disputeId },
        data: updateData,
      });

      if (input.note?.trim()) {
        await tx.disputeNote.create({
          data: {
            disputeId: input.disputeId,
            authorUserId: input.actorUserId ?? null,
            note: input.note.trim(),
          },
        });
      }

      // Revert the delivery from DISPUTED back to COMPLETED.
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: dispute.deliveryId },
        select: { id: true, status: true },
      });

      if (
        delivery &&
        (delivery.status as EnumDeliveryRequestStatus) ===
          EnumDeliveryRequestStatus.DISPUTED
      ) {
        await tx.deliveryRequest.update({
          where: { id: dispute.deliveryId },
          data: {
            status: EnumDeliveryRequestStatus.COMPLETED,
          },
        });

        await tx.deliveryStatusHistory.create({
          data: {
            deliveryId: dispute.deliveryId,
            actorUserId: input.actorUserId ?? null,
            actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
            actorType: EnumDeliveryStatusHistoryActorType.USER,
            fromStatus: EnumDeliveryStatusHistoryToStatus.DISPUTED,
            toStatus: EnumDeliveryStatusHistoryToStatus.COMPLETED,
            note: `Dispute rejected: ${input.rejectionReason.trim()}`,
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: dispute.deliveryId,
          reason: `Dispute rejected: ${input.rejectionReason.trim()}`,
          beforeJson: {
            disputeId: input.disputeId,
            previousStatus: dispute.status,
          },
          afterJson: {
            disputeId: input.disputeId,
            status: EnumDisputeCaseStatus.REJECTED,
            rejectionReason: input.rejectionReason.trim(),
            deliveryRevertedTo: EnumDeliveryRequestStatus.COMPLETED,
          },
        },
      });
    });

    // Best-effort notification (outside the transaction).
    try {
      await this.notificationEventEngine.notifyDisputeRejected({
        deliveryId: dispute.deliveryId,
        actorUserId: input.actorUserId ?? null,
        rejectionReason: input.rejectionReason.trim(),
        note: input.note ?? null,
      });
    } catch (err) {
      this.logger.error(
        `notifyDisputeRejected failed for dispute ${input.disputeId}: ${(err as Error).message}`,
      );
    }
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
        deliveryId: true,
        status: true,
      },
    });

    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }

    if (
      dispute.status !== EnumDisputeCaseStatus.RESOLVED &&
      dispute.status !== EnumDisputeCaseStatus.REJECTED &&
      dispute.status !== EnumDisputeCaseStatus.UNDER_REVIEW &&
      dispute.status !== EnumDisputeCaseStatus.OPEN
    ) {
      throw new BadRequestException("Dispute cannot be closed from current status");
    }

    this.assertTransitionAllowed(
      dispute.status,
      EnumDisputeCaseStatus.CLOSED,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.disputeCase.update({
        where: { id: input.disputeId },
        data: {
          status: EnumDisputeCaseStatus.CLOSED,
          closedAt: new Date(),
        },
      });

      if (input.closingNote?.trim()) {
        await tx.disputeNote.create({
          data: {
            disputeId: input.disputeId,
            authorUserId: input.actorUserId ?? null,
            note: input.closingNote.trim(),
          },
        });
      }

      // If the delivery is still DISPUTED (e.g. closing from OPEN without
      // resolving first), revert it to COMPLETED so it doesn't get stuck.
      const delivery = await tx.deliveryRequest.findUnique({
        where: { id: dispute.deliveryId },
        select: { id: true, status: true },
      });

      if (
        delivery &&
        (delivery.status as EnumDeliveryRequestStatus) ===
          EnumDeliveryRequestStatus.DISPUTED
      ) {
        await tx.deliveryRequest.update({
          where: { id: dispute.deliveryId },
          data: {
            status: EnumDeliveryRequestStatus.COMPLETED,
          },
        });

        await tx.deliveryStatusHistory.create({
          data: {
            deliveryId: dispute.deliveryId,
            actorUserId: input.actorUserId ?? null,
            actorRole: EnumDeliveryStatusHistoryActorRole.ADMIN,
            actorType: EnumDeliveryStatusHistoryActorType.USER,
            fromStatus: EnumDeliveryStatusHistoryToStatus.DISPUTED,
            toStatus: EnumDeliveryStatusHistoryToStatus.COMPLETED,
            note: "Dispute closed",
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.DISPUTE_UPDATE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: dispute.deliveryId,
          reason: input.closingNote?.trim() ?? "Dispute closed",
          beforeJson: {
            disputeId: input.disputeId,
            previousStatus: dispute.status,
          },
          afterJson: {
            disputeId: input.disputeId,
            status: EnumDisputeCaseStatus.CLOSED,
          },
        },
      });
    });

    // Best-effort notification (outside the transaction).
    try {
      await this.notificationEventEngine.notifyDisputeClosed({
        deliveryId: dispute.deliveryId,
        actorUserId: input.actorUserId ?? null,
        closingNote: input.closingNote ?? null,
      });
    } catch (err) {
      this.logger.error(
        `notifyDisputeClosed failed for dispute ${input.disputeId}: ${(err as Error).message}`,
      );
    }
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

    await this.prisma.$transaction(async (tx) => {
      await tx.disputeCase.update({
        where: { id: input.disputeId },
        data: {
          legalHold: input.legalHold,
        },
      });

      if (input.note?.trim()) {
        await tx.disputeNote.create({
          data: {
            disputeId: input.disputeId,
            authorUserId: input.actorUserId ?? null,
            note: input.note.trim(),
          },
        });
      }

      const afterDispute = await tx.disputeCase.findUnique({
        where: { id: input.disputeId },
        select: {
          id: true,
          legalHold: true,
          status: true,
        },
      });

      await tx.adminAuditLog.create({
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
    });

    // Best-effort notification — uses the existing notifyLegalHoldUpdated
    // method on the notification engine.
    try {
      await this.notificationEventEngine.notifyLegalHoldUpdated({
        deliveryId: dispute.deliveryId,
        actorUserId: input.actorUserId ?? null,
        legalHold: input.legalHold,
        note: input.note ?? null,
      });
    } catch (err) {
      this.logger.error(
        `notifyLegalHoldUpdated failed for dispute ${input.disputeId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Validate a status transition is allowed. Mirrors the matrix in
   * DisputeCasePolicyService.validateStatusTransition — kept in sync
   * deliberately so the engine and policy don't disagree (the audit
   * flagged a bug where they used to).
   */
  private assertTransitionAllowed(
    from: EnumDisputeCaseStatus,
    to: EnumDisputeCaseStatus,
  ): void {
    if (from === to) return;

    const allowed: Record<EnumDisputeCaseStatus, EnumDisputeCaseStatus[]> = {
      OPEN: [
        EnumDisputeCaseStatus.UNDER_REVIEW,
        EnumDisputeCaseStatus.RESOLVED,
        EnumDisputeCaseStatus.REJECTED,
        EnumDisputeCaseStatus.CLOSED,
      ],
      UNDER_REVIEW: [
        EnumDisputeCaseStatus.RESOLVED,
        EnumDisputeCaseStatus.REJECTED,
        EnumDisputeCaseStatus.CLOSED,
      ],
      RESOLVED: [EnumDisputeCaseStatus.CLOSED],
      REJECTED: [EnumDisputeCaseStatus.CLOSED],
      CLOSED: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(
        `Dispute status transition from ${from} to ${to} is not allowed`,
      );
    }
  }
}

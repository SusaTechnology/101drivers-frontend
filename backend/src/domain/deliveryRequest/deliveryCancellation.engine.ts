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
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryFromStatus,
  EnumDeliveryStatusHistoryToStatus,
  EnumDriverPayoutStatus,
  EnumDriverPayoutType,
  EnumPaymentEventType,
  EnumPaymentStatus,
  EnumTrackingSessionStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificationEventEngine } from "../notificationEvent/notificationEvent.engine";
import { TrackingGateway } from "../../gateways/tracking.gateway";
import { StripeService } from "../../providers/stripe/stripe.service";

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class DeliveryCancellationEngine {
  private readonly logger = new Logger(DeliveryCancellationEngine.name);

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
          lockedInAt: true,
          lockInBaseFee: true,
          lockInDriverSharePct: true,
          lockInPaymentIntentId: true,
          payment: {
            select: {
              id: true,
              amount: true,
              status: true,
              providerPaymentIntentId: true,
              lockInAmount: true,
              lockInChargeId: true,
            },
          },
          payout: {
            select: {
              id: true,
              status: true,
              type: true,
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

      // ── LOCK-IN DETECTION ────────────────────────────────────────────
      // If the trip was locked in at start (base fee already captured), the
      // customer is NOT refunded, and the driver KEEPS their lock-in payout.
      // We do NOT void the auth hold either — the partial capture at start
      // already released the remainder automatically.
      const isLockedIn =
        !!delivery.lockedInAt &&
        !!delivery.lockInBaseFee &&
        delivery.lockInBaseFee > 0;
      const lockInAmount = isLockedIn
        ? Number(delivery.lockInBaseFee!.toFixed(2))
        : 0;

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

      // ── DRIVER PAYOUT ───────────────────────────────────────────────
      if (isLockedIn) {
        // Lock-in flow: driver KEEPS their lock-in payout (do not cancel it).
        // If a payout row already exists (created at startTrip), ensure it's
        // ELIGIBLE with the lock-in amounts. Otherwise create one now.
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
        // Legacy flow: cancel the payout, driver gets $0
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

      // ── CUSTOMER PAYMENT ────────────────────────────────────────────
      if (delivery.payment?.id) {
        if (isLockedIn) {
          // Lock-in flow: base fee was already captured at start. Mark the
          // Payment as CAPTURED for the lock-in amount only. No refund.
          // No Stripe call — the partial capture already happened at start.
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
              message: `Lock-in base fee retained on cancellation ($${lockInAmount.toFixed(2)}). No refund issued — trip was started.`,
            },
          });
        } else if (delivery.payment.status === EnumPaymentStatus.AUTHORIZED) {
          // Legacy: void the auth hold
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

          if (delivery.payment.providerPaymentIntentId && this.stripeService) {
            try {
              await this.stripeService.cancelPaymentIntent(delivery.payment.providerPaymentIntentId);
              this.logger.log(
                `Cancelled Stripe PaymentIntent ${delivery.payment.providerPaymentIntentId} for delivery ${delivery.id}`,
              );
            } catch (err: any) {
              this.logger.warn(
                `Failed to cancel Stripe PI ${delivery.payment.providerPaymentIntentId}: ${err.message}`,
              );
            }
          }
        } else if (
          delivery.payment.status === EnumPaymentStatus.CAPTURED ||
          delivery.payment.status === EnumPaymentStatus.PAID
        ) {
          // Legacy: full refund
          if (delivery.payment.providerPaymentIntentId && this.stripeService) {
            try {
              const pi = await this.stripeService.getPaymentIntent(delivery.payment.providerPaymentIntentId);
              const charge = pi.latest_charge;
              if (charge) {
                const chargeId = typeof charge === 'string' ? charge : (charge as any).id;
                await this.stripeService.createRefund({
                  chargeId,
                  reason: 'requested_by_customer',
                  metadata: {
                    paymentId: delivery.payment.id,
                    deliveryId: delivery.id,
                    reason: 'auto-refund-on-cancellation',
                  },
                });
                this.logger.log(
                  `Refunded charge ${chargeId} for captured payment on delivery ${delivery.id}`,
                );
              }
            } catch (err: any) {
              this.logger.warn(
                `Failed to refund captured payment ${delivery.payment.id} on delivery ${delivery.id}: ${err.message}. Admin manual refund may be needed.`,
              );
            }
          }

          await tx.payment.update({
            where: { id: delivery.payment.id },
            data: {
              status: EnumPaymentStatus.REFUNDED,
              refundedAt: now,
            },
          });

          await tx.paymentEvent.create({
            data: {
              paymentId: delivery.payment.id,
              type: EnumPaymentEventType.REFUND,
              status: EnumPaymentStatus.REFUNDED,
              amount: delivery.payment.amount,
              message: "Auto-refund issued because delivery was cancelled after payment capture",
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
          note: isLockedIn
            ? (this.trimOrNull(input.note) ??
               `Delivery cancelled after start — lock-in base fee $${lockInAmount.toFixed(2)} retained (non-refundable)`)
            : (this.trimOrNull(input.note) ?? "Delivery cancelled"),
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
        lockInRetained: isLockedIn,
        lockInAmount,
        lockInDriverSharePct: delivery.lockInDriverSharePct ?? null,
      };
    });

    await this.notificationEventEngine.notifyDeliveryCancelled({
      deliveryId: result.deliveryId,
      actorUserId: input.actorUserId ?? null,
      driverId: result.driverId,
      lockInRetained: result.lockInRetained,
      lockInAmount: result.lockInAmount,
      lockInDriverSharePct: result.lockInDriverSharePct,
    });

    this.emitStatusChanged(
      result.deliveryId,
      EnumDeliveryRequestStatus.CANCELLED,
      result.customerId,
      {
        retained: result.lockInRetained,
        amount: result.lockInAmount,
        driverSharePct: result.lockInDriverSharePct,
      },
    );

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

    // ACTIVE deliveries CAN be cancelled (the lock-in base fee captured at
    // start is retained — customer is not refunded, driver keeps the lock-in
    // payout). This is the intended behavior per the lock-in feature.
    // Previously this path was blocked, which prevented legitimate
    // post-start cancellations (e.g. car won't start, customer cancels).
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
import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  HttpCode,
  Injectable,
  Optional,
  Inject,
} from "@nestjs/common";
import { Request, Response } from "express";
import { StripeService } from "../providers/stripe/stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { PostpaidBillingService } from "../postpaidBilling/postpaidBilling.service";

@Controller("stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(NotificationEventEngine)
    private readonly notificationEngine?: NotificationEventEngine,
    @Optional() @Inject(PostpaidBillingService)
    private readonly postpaidBilling?: PostpaidBillingService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers("stripe-signature") signature: string,
  ) {
    let event: any;

    try {
      // req.body is a raw Buffer here because bodyParser.raw() is registered
      // for this route in main.ts, bypassing NestJS's default JSON parser.
      const rawBody = (req.body as Buffer).toString("utf8");
      event = this.stripeService.verifyWebhookEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      const stripeEventId = event.id;
      switch (event.type) {
        case "payment_intent.amount_capturable_updated":
          await this.handlePaymentIntentAmountCapturableUpdated(event.data.object, stripeEventId);
          break;

        case "payment_intent.succeeded":
          await this.handlePaymentIntentSucceeded(event.data.object, stripeEventId);
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(event.data.object, stripeEventId);
          break;

        case "payment_intent.canceled":
          await this.handlePaymentIntentCanceled(event.data.object, stripeEventId);
          break;

        case "charge.refunded":
          await this.handleChargeRefunded(event.data.object, stripeEventId);
          break;

        case "transfer.created":
          await this.handleTransferCreated(event.data.object, stripeEventId);
          break;

        case "transfer.paid":
          await this.handleTransferPaid(event.data.object, stripeEventId);
          break;

        case "transfer.failed":
          await this.handleTransferFailed(event.data.object, stripeEventId);
          break;

        case "account.updated":
          await this.handleAccountUpdated(event.data.object);
          break;

        case "charge.dispute.created":
          await this.handleChargeDisputeCreated(event.data.object, stripeEventId);
          break;

        case "charge.dispute.closed":
          await this.handleChargeDisputeClosed(event.data.object, stripeEventId);
          break;

        case "setup_intent.succeeded":
          await this.handleSetupIntentSucceeded(event.data.object);
          break;

        // ── Postpaid (Option A) — invoice.* events ──
        // Fired by Stripe's weekly anchor subscription. Delegated to
        // PostpaidBillingService which updates Payment rows + freezes
        // the dealer on charge failure. Safe to no-op if the service
        // isn't injected (e.g. during cold-start when Stripe is disabled).
        case "invoice.upcoming":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoiceUpcoming(event.data.object.id);
          }
          break;

        case "invoice.payment_succeeded":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoicePaymentSucceeded(event.data.object.id);
          }
          break;

        case "invoice.payment_failed":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoicePaymentFailed(event.data.object.id);
          }
          break;

        case "invoice.finalized":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoiceFinalized(event.data.object.id);
          }
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err: any) {
      this.logger.error(`Webhook handler error: ${err.message}`, err.stack);
      res.status(500).send(`Webhook handler error: ${err.message}`);
    }
  }

  // ── Event Handlers ───────────────────────────────────────────────

  /**
   * Fires when a manual-capture PaymentIntent becomes capturable (card confirmed, funds held).
   * This is the "card authorized" moment — send confirmation email to customer.
   */
  private async handlePaymentIntentAmountCapturableUpdated(pi: any, _stripeEventId?: string) {
    const deliveryId = pi.metadata?.deliveryId;
    if (!deliveryId) {
      this.logger.warn(`payment_intent.amount_capturable_updated missing deliveryId: ${pi.id}`);
      return;
    }

    // Only act on non-tip payments
    if (pi.metadata?.type === "tip") {
      return;
    }

    // Only send once — only when PI transitions to requires_capture
    if (pi.status !== "requires_capture") {
      return;
    }

    const payment = await this.prisma.payment.findUnique({ where: { deliveryId } });
    if (!payment) {
      this.logger.warn(`payment_intent.amount_capturable_updated: no payment found for delivery ${deliveryId}`);
      return;
    }

    // Update payment status to AUTHORIZED if not already
    if (payment.status !== "AUTHORIZED") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "AUTHORIZED" },
      });
    }

    // Send "Payment Confirmed" email (fire-and-forget, non-blocking)
    if (this.notificationEngine) {
      try {
        await this.notificationEngine.notifyPaymentAuthorized({
          deliveryId,
          amount: pi.amount / 100,
        });
      } catch (err: any) {
        this.logger.error(`Failed to send payment authorized email for delivery ${deliveryId}: ${err.message}`);
      }
    }

    this.logger.log(`Payment authorized for delivery ${deliveryId} (PI: ${pi.id})`);
  }

  private async handlePaymentIntentSucceeded(pi: any, stripeEventId?: string) {
    const deliveryId = pi.metadata?.deliveryId;
    if (!deliveryId) {
      this.logger.warn(`payment_intent.succeeded missing deliveryId: ${pi.id}`);
      return;
    }

    // Tip PaymentIntents have metadata.type = "tip" — update Tip record, not Payment
    if (pi.metadata?.type === "tip") {
      const tip = await this.prisma.tip.findUnique({ where: { deliveryId } });
      if (!tip) {
        this.logger.warn(`payment_intent.succeeded: no tip found for delivery ${deliveryId}`);
        return;
      }
      await this.prisma.tip.update({
        where: { id: tip.id },
        data: { status: "CAPTURED" },
      });

      // Tips are added to a delivery AFTER completion (see
      // stripe-payment.controller.ts createTipPaymentIntent which requires
      // delivery.status === COMPLETED). At completion time, handleCompletionTx
      // in PaymentPayoutEngine looked up delivery.tip — but it didn't exist
      // yet, so the DriverPayout.netAmount was created WITHOUT the tip.
      //
      // Now that the tip is captured, we retroactively add it to the
      // driver's payout. The full tip amount goes to the driver (matches
      // computeBreakdown which adds tipAmount directly to netAmount, not
      // multiplied by driverSharePct).
      //
      // If the payout doesn't exist yet (e.g. postpaid delivery awaiting
      // invoicing) we skip — the tip will be picked up when admin invoices
      // the delivery (adminInvoicePostpaid calls computeBreakdown with the
      // then-current tip amount).
      try {
        const payout = await this.prisma.driverPayout.findUnique({
          where: { deliveryId },
        });
        if (payout && payout.status !== "CANCELLED") {
          // Only add the tip to netAmount (driver keeps 100% of tips per
          // computeBreakdown). grossAmount stays as the original quote.
          const newNet = Number(
            (Number(payout.netAmount) + Number(tip.amount)).toFixed(2),
          );
          await this.prisma.driverPayout.update({
            where: { id: payout.id },
            data: { netAmount: newNet },
          });
          this.logger.log(
            `Tip $${Number(tip.amount).toFixed(2)} added to driver payout for ` +
            `delivery ${deliveryId} — new netAmount=$${newNet.toFixed(2)}`,
          );
        }
      } catch (payoutErr: any) {
        // Don't fail the webhook over a payout update issue — the tip
        // capture itself already succeeded. Admin can manually adjust.
        this.logger.error(
          `Failed to add tip to driver payout for delivery ${deliveryId}: ${payoutErr?.message}`,
        );
      }

      this.logger.log(`Tip captured for delivery ${deliveryId} (PI: ${pi.id})`);
      return;
    }

    const payment = await this.prisma.payment.findUnique({ where: { deliveryId } });
    if (!payment) {
      this.logger.warn(`payment_intent.succeeded: no payment found for delivery ${deliveryId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        capturedAt: new Date(),
        providerChargeId: pi.latest_charge,
      },
    });

    await this.createPaymentEventIdempotent({
      paymentId: payment.id,
      type: "CAPTURE",
      status: "CAPTURED",
      amount: pi.amount / 100,
      message: "Payment succeeded via webhook",
      providerRef: pi.id,
      raw: pi as any,
      stripeEventId,
    });

    // Send "Payment Receipt" email (fire-and-forget, non-blocking)
    if (this.notificationEngine) {
      try {
        await this.notificationEngine.notifyPaymentCaptured({
          deliveryId,
          amount: pi.amount / 100,
        });
      } catch (err: any) {
        this.logger.error(`Failed to send payment receipt email for delivery ${deliveryId}: ${err.message}`);
      }
    }

    this.logger.log(`Payment captured for delivery ${deliveryId} (PI: ${pi.id})`);
  }

  private async handlePaymentIntentFailed(pi: any, stripeEventId?: string) {
    const deliveryId = pi.metadata?.deliveryId;
    if (!deliveryId) return;

    // Tip PaymentIntents — update Tip record
    if (pi.metadata?.type === "tip") {
      const tip = await this.prisma.tip.findUnique({ where: { deliveryId } });
      if (tip) {
        await this.prisma.tip.update({
          where: { id: tip.id },
          data: { status: "FAILED" },
        });
      }
      this.logger.warn(`Tip payment failed for delivery ${deliveryId}`);
      return;
    }

    const payment = await this.prisma.payment.findUnique({ where: { deliveryId } });
    if (!payment) {
      this.logger.warn(`payment_intent.failed: no payment found for delivery ${deliveryId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureCode: pi.last_payment_error?.code || "unknown",
        failureMessage: pi.last_payment_error?.message || "Payment failed",
      },
    });

    await this.createPaymentEventIdempotent({
      paymentId: payment.id,
      type: "FAIL",
      status: "FAILED",
      amount: pi.amount / 100,
      message: pi.last_payment_error?.message || "Payment failed",
      providerRef: pi.id,
      raw: pi as any,
      stripeEventId,
    });

    this.logger.warn(`Payment failed for delivery ${deliveryId}: ${pi.last_payment_error?.message}`);

    // Notify the customer that their payment failed asynchronously
    if (this.notificationEngine) {
      try {
        await this.notificationEngine.notifyPaymentFailed({
          deliveryId,
          amount: pi.amount / 100,
          failureReason: pi.last_payment_error?.message,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to send payment-failed notification for delivery ${deliveryId}: ${err.message}`,
        );
      }
    }
  }

  private async handlePaymentIntentCanceled(pi: any, stripeEventId?: string) {
    const deliveryId = pi.metadata?.deliveryId;
    if (!deliveryId) return;

    // Tip PaymentIntents — update Tip record
    if (pi.metadata?.type === "tip") {
      const tip = await this.prisma.tip.findUnique({ where: { deliveryId } });
      if (tip) {
        await this.prisma.tip.update({
          where: { id: tip.id },
          data: { status: "FAILED" },
        });
      }
      this.logger.log(`Tip payment cancelled for delivery ${deliveryId}`);
      return;
    }

    const payment = await this.prisma.payment.findUnique({ where: { deliveryId } });
    if (!payment) {
      this.logger.warn(`payment_intent.canceled: no payment found for delivery ${deliveryId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "VOIDED", voidedAt: new Date() },
    });

    await this.createPaymentEventIdempotent({
      paymentId: payment.id,
      type: "VOID",
      status: "VOIDED",
      message: "PaymentIntent cancelled via Stripe webhook",
      providerRef: pi.id,
      raw: pi as any,
      stripeEventId,
    });

    this.logger.log(`Payment voided for delivery ${deliveryId} (PI: ${pi.id})`);
  }

  private async handleChargeRefunded(charge: any, stripeEventId?: string) {
    // Find the payment by providerChargeId, with fallback to lockInChargeId
    // (for two-PI lock-in deliveries, the lock-in charge may not match the
    // current providerChargeId which points to PI #2's charge).
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { providerChargeId: charge.id },
          { lockInChargeId: charge.id },
        ],
      },
    });
    if (!payment) {
      this.logger.warn(`Refund for unknown charge: ${charge.id}`);
      return;
    }

    // ── Fix #5: Partial refund tracking ──
    // `charge.amount_refunded` is the CUMULATIVE amount refunded (in
    // cents), not the amount of THIS refund event. Stripe keeps
    // updating this field as more refunds are issued. So we can just
    // copy it to `refundedAmountCents` and derive the refundStatus.
    //
    // We also create a DriverPayoutAdjustment (Fix #6) for the
    // driver's proportional share of the refund — see
    // `handleDriverPayoutClawback` below.
    const cumulativeRefundedCents = charge.amount_refunded || 0;
    const totalAmountCents = Math.round(Number(payment.amount) * 100);
    const isFullRefund = cumulativeRefundedCents >= totalAmountCents;
    const refundStatus = isFullRefund
      ? "FULL"
      : cumulativeRefundedCents > 0
        ? "PARTIAL"
        : "NONE";

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        // Keep the legacy `status` field for backward compat — only
        // flip to REFUNDED when fully refunded. Partial refunds keep
        // the original status (CAPTURED) so existing code that reads
        // `status` continues to work.
        status: isFullRefund ? "REFUNDED" : payment.status,
        refundedAt: isFullRefund ? new Date() : payment.refundedAt,
        providerChargeId: charge.id,
        // ── Fix #5: new partial-refund fields ──
        refundedAmountCents: cumulativeRefundedCents,
        refundStatus,
      },
    });

    await this.createPaymentEventIdempotent({
      paymentId: payment.id,
      type: "REFUND",
      status: "REFUNDED",
      amount: cumulativeRefundedCents / 100,
      message: `Refund ${isFullRefund ? "full" : "partial"} ($${(cumulativeRefundedCents / 100).toFixed(2)} of $${(totalAmountCents / 100).toFixed(2)})${payment.lockInChargeId === charge.id ? " (on lock-in charge)" : ""}`,
      providerRef: charge.refunds?.data?.[0]?.id,
      raw: charge as any,
      stripeEventId,
    });

    // ── Fix #6: Driver payout clawback on refund ──
    // The customer got money back, so the driver's payout should be
    // reduced proportionally. Best-effort — failures are logged but
    // don't fail the webhook.
    try {
      await this.createDriverPayoutClawback({
        paymentId: payment.id,
        refundAmountCents: cumulativeRefundedCents,
        reason: "REFUND",
        stripeEventId,
      });
    } catch (err: any) {
      this.logger.error(
        `Driver payout clawback failed for payment ${payment.id} (refund): ${err.message}`,
        err?.stack,
      );
    }

    this.logger.log(
      `Refund processed for payment ${payment.id}: $${(cumulativeRefundedCents / 100).toFixed(2)} / $${(totalAmountCents / 100).toFixed(2)} (${refundStatus})`,
    );
  }

  // ── Driver payout clawback on refund / dispute (Fix #6) ────────
  //
  // When a customer gets their money back (refund or dispute lost),
  // the driver's payout for that delivery should be reduced
  // proportionally. Otherwise the platform eats the refund — the
  // driver keeps their payout, the customer gets their money back,
  // and the platform loses twice.
  //
  // This helper:
  //   1. Finds the original DriverPayout for the delivery (if any)
  //   2. Computes the proportional clawback:
  //        clawback = -(refundAmount / totalAmount) * driverNet
  //   3. Creates a DriverPayoutAdjustment row with status=PENDING
  //   4. The adjustment is applied to the driver's NEXT payout (by
  //      `paymentPayoutEngine.handleCompletionTx` or the payout batch
  //      initiator).
  //
  // For partial refunds, the clawback is proportional to the refund
  // amount. For full refunds, the full driverNet is clawed back.
  //
  // Idempotent via `stripeEventId` — if Stripe retries the webhook,
  // the unique constraint on `stripeEventId` prevents duplicate
  // clawback rows.
  private async createDriverPayoutClawback(input: {
    paymentId: string;
    refundAmountCents: number;
    reason: string;
    stripeEventId?: string;
  }): Promise<void> {
    if (input.refundAmountCents <= 0) return;

    // Find the original payout for this payment's delivery
    const payment = await this.prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: { deliveryId: true, amount: true },
    });
    if (!payment?.deliveryId) return;

    const payout = await this.prisma.driverPayout.findUnique({
      where: { deliveryId: payment.deliveryId },
      select: { id: true, driverId: true, netAmount: true, driverSharePct: true },
    });
    if (!payout) {
      // No payout exists yet (e.g. refund before trip completion).
      // Skip — the payout will be created at completion, and we can't
      // claw back what doesn't exist yet. Admin can manually adjust.
      this.logger.log(
        `No DriverPayout found for delivery ${payment.deliveryId} — skipping clawback. ` +
          `Admin should manually adjust if a payout is created later.`,
      );
      return;
    }

    // Compute the proportional clawback. The driver's share of the
    // refund equals (refundAmount / totalAmount) × driverNet.
    const totalAmountCents = Math.round(Number(payment.amount) * 100);
    if (totalAmountCents <= 0) return;

    const refundRatio = input.refundAmountCents / totalAmountCents;
    const clawbackAmount = Number((Number(payout.netAmount) * refundRatio).toFixed(2));

    if (clawbackAmount <= 0) return;

    // Create the adjustment. The unique constraint on `stripeEventId`
    // makes this idempotent — if the webhook is retried, the insert
    // fails with P2002 and we skip (no duplicate clawback).
    try {
      await this.prisma.driverPayoutAdjustment.create({
        data: {
          driverId: payout.driverId,
          deliveryId: payment.deliveryId,
          paymentId: input.paymentId,
          originalPayoutId: payout.id,
          amount: -clawbackAmount, // negative = deduction from driver
          reason: input.reason,
          status: "PENDING",
          stripeEventId: input.stripeEventId ?? null,
          note: `Auto-clawback: ${input.reason} of $${(input.refundAmountCents / 100).toFixed(2)} (${(refundRatio * 100).toFixed(1)}% of $${(totalAmountCents / 100).toFixed(2)})`,
        },
      });
      this.logger.log(
        `Created DriverPayoutAdjustment for driver ${payout.driverId}: -$${clawbackAmount.toFixed(2)} ` +
          `(refund of $${(input.refundAmountCents / 100).toFixed(2)} on delivery ${payment.deliveryId})`,
      );
    } catch (err: any) {
      if (
        err?.code === "P2002" &&
        Array.isArray(err?.meta?.target) &&
        err.meta.target.includes("stripeEventId")
      ) {
        this.logger.log(
          `DriverPayoutAdjustment for ${input.stripeEventId} already exists — skipping (idempotent)`,
        );
        return;
      }
      throw err;
    }
  }

  private async handleTransferCreated(transfer: any, _stripeEventId?: string) {
    this.logger.log(`Transfer created: ${transfer.id} → ${transfer.destination} ($${transfer.amount / 100})`);
  }

  private async handleTransferPaid(transfer: any, _stripeEventId?: string) {
    // Update payout record when transfer completes
    const payoutId = transfer.metadata?.payoutId;
    if (!payoutId) {
      this.logger.log(`Transfer ${transfer.id} paid — no payoutId in metadata, skipping DB update`);
      return;
    }

    // ── Fix #10: out-of-order webhooks ──
    // Stripe can deliver webhooks out of order (e.g. `transfer.paid`
    // before `transfer.created` if there's a network delay). If the
    // payout row doesn't exist yet, the update throws
    // `P2025 RecordNotFound`. We log a clear warning + return 200 so
    // Stripe doesn't retry. The admin can manually reconcile — or
    // `transfer.created` will arrive later and create the row.
    //
    // Note: in the current flow, the payout row is created BEFORE the
    // transfer is initiated (in `initiateDriverTransfer`), so this
    // shouldn't happen in practice. The guard is defensive.
    let payout;
    try {
      payout = await this.prisma.driverPayout.update({
        where: { id: payoutId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          providerTransferId: transfer.id,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2025") {
        this.logger.warn(
          `handleTransferPaid: payout ${payoutId} not found (out-of-order webhook or missing payout) — ` +
          `Stripe transfer ${transfer.id} was paid but we have no matching payout row. ` +
          `Admin should manually reconcile.`,
        );
        return;
      }
      throw err;
    }
    this.logger.log(`Payout ${payoutId} paid via transfer ${transfer.id}`);

    // Notify the driver that their payout has landed
    if (this.notificationEngine) {
      try {
        await this.notificationEngine.notifyDriverPayoutPaid({
          deliveryId: payout.deliveryId,
          driverId: payout.driverId,
          amount: payout.netAmount,
          payoutType: payout.type === "LOCK_IN_FEE" ? "LOCK_IN_FEE" : "TRIP_COMPLETION",
          transferId: transfer.id,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to send driver payout-paid notification for payout ${payoutId}: ${err.message}`,
        );
      }
    }

    // Notify admin(s) that the platform commission has been received.
    // At this point:
    //   • The customer's full payment was captured (lock-in at trip start
    //     + remainder at completion).
    //   • The driver's transfer has settled into their Connect balance
    //     (Stripe confirmed via this very transfer.paid webhook).
    //   • The platform's commission (grossAmount - netAmount = platformFee,
    //     already stored on the DriverPayout row) is now realized in the
    //     platform's Stripe balance.
    //
    // This is the most Stripe-confirmed moment to notify the admin —
    // firing earlier (e.g., at transfer creation) would be premature
    // because the transfer could still fail and the commission would
    // never materialize.
    //
    // For referral payouts (REFERRAL_REFERRER, REFERRAL_REFERRED),
    // there's no commission to admins and no delivery to look up, so
    // we skip this notification entirely.
    if (this.notificationEngine && payout.deliveryId) {
      try {
        await this.notificationEngine.notifyAdminCommissionReceived({
          deliveryId: payout.deliveryId,
          driverId: payout.driverId,
          grossAmount: Number(payout.grossAmount ?? 0),
          driverNetAmount: Number(payout.netAmount ?? 0),
          commissionAmount: Number(payout.platformFee ?? 0),
          transferId: transfer.id,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to send admin commission-received notification for payout ${payoutId}: ${err.message}`,
        );
      }
    }
  }

  private async handleTransferFailed(transfer: any, _stripeEventId?: string) {
    const payoutId = transfer.metadata?.payoutId;
    if (!payoutId) {
      this.logger.warn(`Transfer ${transfer.id} failed — no payoutId in metadata`);
      return;
    }

    // ── Fix #10: out-of-order webhooks ──
    // Same defensive guard as handleTransferPaid.
    let payout;
    try {
      payout = await this.prisma.driverPayout.update({
        where: { id: payoutId },
        data: { status: "FAILED", failureMessage: transfer.failure_message || "Transfer failed" },
      });
    } catch (err: any) {
      if (err?.code === "P2025") {
        this.logger.warn(
          `handleTransferFailed: payout ${payoutId} not found (out-of-order webhook or missing payout) — ` +
          `Stripe transfer ${transfer.id} failed but we have no matching payout row. ` +
          `Admin should manually reconcile.`,
        );
        return;
      }
      throw err;
    }
    this.logger.warn(`Payout ${payoutId} failed via transfer ${transfer.id}`);

    // Notify the driver that their payout failed
    if (this.notificationEngine) {
      try {
        await this.notificationEngine.notifyDriverPayoutFailed({
          deliveryId: payout.deliveryId,
          driverId: payout.driverId,
          amount: payout.netAmount,
          transferId: transfer.id,
          failureReason: transfer.failure_message || "Stripe returned a transfer failure",
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to send driver payout-failed notification for payout ${payoutId}: ${err.message}`,
        );
      }
    }
  }

  private async handleAccountUpdated(account: any) {
    const driverId = account.metadata?.driverId;
    if (!driverId) return;

    // Map Stripe account status to our status
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    if (detailsSubmitted && chargesEnabled && payoutsEnabled) {
      // Account is fully onboarded
      this.logger.log(`Driver ${driverId} Stripe account activated: ${account.id}`);
    } else if (detailsSubmitted) {
      this.logger.log(`Driver ${driverId} Stripe account pending: ${account.id}`);
    }
  }

  private async handleChargeDisputeCreated(dispute: any, stripeEventId?: string) {
    const chargeId = dispute.charge;
    if (!chargeId) {
      this.logger.warn("charge.dispute.created missing charge ID");
      return;
    }

    // Find payment by charge ID (check both providerChargeId and lockInChargeId)
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { providerChargeId: chargeId },
          { lockInChargeId: chargeId },
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`charge.dispute.created: no payment found for charge ${chargeId}`);
      return;
    }

    const isOnLockInCharge = payment.lockInChargeId === chargeId;
    const disputedAmountCents = dispute.amount || 0;
    const disputedAmountDollars = disputedAmountCents / 100;
    const totalAmountCents = Math.round(Number(payment.amount) * 100);

    // Determine refund status — for a dispute, the full charge amount is
    // disputed, so refundStatus = FULL.
    const refundStatus = disputedAmountCents >= totalAmountCents ? "FULL" : "PARTIAL";

    // Update payment to REFUNDED — Stripe reverses the funds when a
    // dispute is opened. Also track the dispute ID + status (Fix #3) so
    // the charge.dispute.closed handler can revert this if the admin
    // wins the dispute.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
        failureCode: "DISPUTE",
        failureMessage: `Stripe dispute ${dispute.id}: ${dispute.reason || "Customer dispute"}${isOnLockInCharge ? " (on lock-in charge)" : ""}`,
        // ── Fix #3: dispute tracking ──
        disputeId: dispute.id,
        disputeStatus: dispute.status || "needs_response",
        // ── Fix #5: partial refund tracking ──
        refundedAmountCents: disputedAmountCents,
        refundStatus,
      },
    });

    // Create audit event with stripeEventId for idempotency (Fix #4)
    await this.createPaymentEventIdempotent({
      paymentId: payment.id,
      type: "REFUND",
      status: "REFUNDED",
      amount: disputedAmountDollars,
      message: `Chargeback opened: ${dispute.reason || "dispute"}. Evidence deadline: ${dispute.evidence_details?.due_by || "unknown"}${isOnLockInCharge ? " (on lock-in charge)" : ""}`,
      providerRef: dispute.id,
      raw: dispute as any,
      stripeEventId,
    });

    this.logger.warn(
      `Stripe dispute ${dispute.id} opened for payment ${payment.id} (delivery ${payment.deliveryId}). Reason: ${dispute.reason}`,
    );
  }

  // ── charge.dispute.closed (Fix #3) ────────────────────────────
  //
  // Fires when a dispute is closed — either won (Stripe reversed the
  // refund, customer's charge stands) or lost (refund stays, customer
  // won the dispute). Without this handler, winning a dispute would
  // leave the Payment in REFUNDED state forever — the customer can't
  // place new deliveries (we think they're refunded), financial reports
  // are wrong, and the driver's payout (if clawed back) isn't
  // reinstated.
  //
  // On `won`:
  //   - Revert Payment from REFUNDED → CAPTURED
  //   - Clear disputeId + disputeStatus
  //   - Reset refundedAmountCents = 0, refundStatus = NONE
  //   - Reverse any DriverPayoutAdjustment that was created on dispute
  //     creation (Fix #6 — handled by the adjustment service, called
  //     separately).
  //
  // On `lost`:
  //   - Keep Payment as REFUNDED (no change to status)
  //   - Update disputeStatus to "lost"
  //   - The driver payout adjustment (if any) stays in place — the
  //     driver doesn't get their money back for a lost dispute.

  private async handleChargeDisputeClosed(dispute: any, stripeEventId?: string) {
    const disputeId = dispute.id;
    if (!disputeId) {
      this.logger.warn("charge.dispute.closed missing dispute ID");
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { disputeId },
    });

    if (!payment) {
      this.logger.warn(
        `charge.dispute.closed: no payment found for dispute ${disputeId} ` +
          `(maybe the dispute was opened before the disputeId field was added — admin should manually fix this payment's status)`,
      );
      return;
    }

    const disputeStatus = dispute.status || "unknown";
    const isWon = disputeStatus === "won";
    const isLost = disputeStatus === "lost";

    this.logger.log(
      `Stripe dispute ${disputeId} closed as ${disputeStatus} for payment ${payment.id} (delivery ${payment.deliveryId})`,
    );

    if (isWon) {
      // Dispute won — Stripe reverses the refund, customer's charge stands.
      // Revert Payment back to CAPTURED.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "CAPTURED",
          // Clear dispute tracking
          disputeId: null,
          disputeStatus: null,
          // Reset refund tracking — the refund was reversed
          refundedAmountCents: 0,
          refundStatus: "NONE",
          refundedAt: null,
          // Clear the dispute-related failure code
          failureCode: null,
          failureMessage: null,
        },
      });

      await this.createPaymentEventIdempotent({
        paymentId: payment.id,
        type: "MARK_PAID",
        status: "PAID",
        amount: payment.amount,
        message: `Dispute WON — charge ${dispute.charge} reinstated. Payment reverted to CAPTURED.`,
        providerRef: disputeId,
        raw: dispute as any,
        stripeEventId,
      });

      this.logger.log(
        `Dispute ${disputeId} won — payment ${payment.id} reverted to CAPTURED`,
      );
    } else if (isLost) {
      // Dispute lost — refund stays. Just update the status.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          disputeStatus: "lost",
        },
      });

      await this.createPaymentEventIdempotent({
        paymentId: payment.id,
        type: "REFUND",
        status: "REFUNDED",
        amount: dispute.amount / 100,
        message: `Dispute LOST — refund stands. Customer won the chargeback.`,
        providerRef: disputeId,
        raw: dispute as any,
        stripeEventId,
      });

      this.logger.warn(
        `Dispute ${disputeId} lost — payment ${payment.id} stays REFUNDED`,
      );
    } else {
      // Other statuses (warning_closed, etc.) — just record the status change.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { disputeStatus },
      });

      this.logger.log(
        `Dispute ${disputeId} closed with status ${disputeStatus} — payment ${payment.id} status unchanged`,
      );
    }
  }

  // ── Setup Intent Succeeded (card saved) ─────────────────────────

  private async handleSetupIntentSucceeded(setupIntent: any): Promise<void> {
    this.logger.log(
      `SetupIntent ${setupIntent.id} succeeded — card saved`,
    );

    const customerId = setupIntent.metadata?.customer?.id || setupIntent.customer;
    const paymentMethodId = setupIntent.payment_method;

    if (!customerId || !paymentMethodId) {
      this.logger.warn(
        `SetupIntent ${setupIntent.id} succeeded but missing customer or payment_method — skipping`,
      );
      return;
    }

    try {
      // Find our Customer record by stripeCustomerId
      const customer = await this.prisma.customer.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (customer) {
        // Set as default payment method (or keep existing default if one exists)
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { stripeDefaultPaymentMethodId: paymentMethodId },
        });
        this.logger.log(
          `Set default payment method ${paymentMethodId} for customer ${customer.id}`,
        );
      } else {
        this.logger.warn(
          `No Customer record found for Stripe customer ${customerId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to process SetupIntent ${setupIntent.id}: ${err.message}`,
      );
    }
  }

  // ── Idempotent PaymentEvent creation (Fix #4) ──────────────────
  //
  // Stripe retries webhook events for up to ~3 days if it doesn't
  // receive a 200 within 10 seconds. Without idempotency, a retried
  // event would insert a duplicate PaymentEvent audit row each time
  // (the `Payment.update` itself is idempotent — same values — but
  // `paymentEvent.create` is not).
  //
  // This helper:
  //   1. If `stripeEventId` is provided, check if a PaymentEvent with
  //      that ID already exists. If so, skip (idempotent — no-op).
  //   2. Otherwise, insert the PaymentEvent with the `stripeEventId`
  //      field set so future retries are caught by step 1.
  //
  // For non-webhook PaymentEvents (created by our own code),
  // `stripeEventId` is undefined and the helper behaves like a normal
  // `create` (no idempotency check).
  //
  // The unique index on `PaymentEvent.stripeEventId` is the safety net
  // — even if the check-then-insert race condition fires, the DB
  // rejects the second insert.
  private async createPaymentEventIdempotent(input: {
    paymentId: string;
    type: any;
    status?: any;
    amount?: number | null;
    message?: string | null;
    providerRef?: string | null;
    raw?: any;
    stripeEventId?: string;
  }): Promise<void> {
    if (input.stripeEventId) {
      // Check if we've already processed this Stripe event
      const existing = await this.prisma.paymentEvent.findUnique({
        where: { stripeEventId: input.stripeEventId },
        select: { id: true },
      });
      if (existing) {
        this.logger.log(
          `Webhook event ${input.stripeEventId} already processed — skipping duplicate PaymentEvent insert`,
        );
        return;
      }
    }

    try {
      await this.prisma.paymentEvent.create({
        data: {
          paymentId: input.paymentId,
          type: input.type,
          status: input.status,
          amount: input.amount ?? null,
          message: input.message ?? null,
          providerRef: input.providerRef ?? null,
          raw: input.raw ?? undefined,
          stripeEventId: input.stripeEventId ?? null,
        },
      });
    } catch (err: any) {
      // Unique constraint violation means another concurrent handler
      // already inserted this event — safe to ignore.
      if (
        err?.code === "P2002" &&
        Array.isArray(err?.meta?.target) &&
        err.meta.target.includes("stripeEventId")
      ) {
        this.logger.log(
          `Webhook event ${input.stripeEventId} already processed (race condition caught by unique constraint) — skipping`,
        );
        return;
      }
      throw err;
    }
  }
}

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
import { RefundSyncService } from "./refund-sync.service";

/**
 * Payment statuses that have already moved money (or left the PaymentIntent
 * lifecycle) — a late/redelivered `payment_intent.*` event must NEVER
 * regress them. Stripe retries non-2xx webhook deliveries for ~3 days and
 * does not guarantee event ordering, so every PI lifecycle handler must
 * check this list before writing a status.
 */
const PAYMENT_TERMINAL_STATUSES = [
  "CAPTURED", // customer charged — money moved
  "PAID", // postpaid invoice settled — money moved
  "REFUNDED", // charge returned after capture
  "VOIDED", // PaymentIntent canceled before capture (cancellation path)
  "INVOICED", // postpaid usage invoiced — the invoice rail owns this state
];

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
    @Optional() @Inject(RefundSyncService)
    private readonly refundSync?: RefundSyncService,
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

        // ── Platform bank payouts (Task 19) ──
        // Stripe moving PLATFORM money to the company bank account. Must
        // be enabled on the Stripe webhook endpoint — see
        // docs/stripe-live-checklist.md.
        case "payout.paid":
          await this.handlePlatformPayoutUpdate(event.data.object, "PAID");
          break;

        case "payout.failed":
          await this.handlePlatformPayoutUpdate(event.data.object, "FAILED");
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

        // ── Write-off events ──
        // Stripe stops collecting an invoice either because an admin
        // voided it (deliberate debt cancellation) or because its final
        // retry failed and the dashboard's "mark uncollectible" rule
        // fired. Ignoring these used to leave the Payment rows stuck in
        // CHARGE_FAILED and a CHARGE_FAILED-frozen dealer with no way
        // out — no retry can ever succeed on a closed invoice.
        case "invoice.voided":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoiceVoided(event.data.object.id);
          }
          break;

        case "invoice.marked_uncollectible":
          if (this.postpaidBilling) {
            await this.postpaidBilling.handleInvoiceMarkedUncollectible(event.data.object.id);
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

    // Terminal-state guard: a redelivered/out-of-order amount_capturable_updated
    // must not regress a payment whose money already moved (or that the
    // invoice rail owns) back to AUTHORIZED.
    if (PAYMENT_TERMINAL_STATUSES.includes(payment.status)) {
      this.logger.warn(
        `amount_capturable_updated for delivery ${deliveryId} ignored — payment already ${payment.status} (terminal); likely a redelivered/out-of-order Stripe event`,
      );
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
        // The tip endpoint now creates the Tip row BEFORE confirming the PI,
        // so this should be unreachable in normal flow — kept as a safety net.
        this.logger.warn(`payment_intent.succeeded: no tip found for delivery ${deliveryId}`);
        return;
      }

      // ── Idempotency: skip if this exact Stripe event already credited the tip ──
      // Stripe can redeliver events (network retries). Without this check the
      // payout netAmount would be incremented twice (driver overpaid).
      const creditedEventId = stripeEventId ?? pi.id;
      if (tip.payoutCreditedEventId === creditedEventId) {
        this.logger.log(`Tip event ${creditedEventId} already credited for delivery ${deliveryId} — skipping`);
        return;
      }

      await this.prisma.tip.update({
        where: { id: tip.id },
        data: { status: "CAPTURED", payoutCreditedEventId: creditedEventId },
      });

      // Tips are added to a delivery AFTER completion (see
      // stripe-payment.controller.ts createTipPaymentIntent which requires
      // delivery.status === COMPLETED). The payout may already be settled:
      //
      //   • ELIGIBLE  → tip rides along in the next withdrawal/weekly batch
      //                 (add to netAmount — full tip to the driver, matches
      //                 computeBreakdown which does not split tips).
      //   • PAID      → the payout was already transferred to the driver's
      //                 bank (the NORMAL case, since completion auto-transfers
      //                 and tips arrive minutes later). Creating a positive
      //                 TIP DriverPayoutAdjustment pays the tip on the
      //                 driver's next payout rail (next completion transfer
      //                 or the next withdrawal batch — batch rails apply
      //                 pending adjustments).
      //   • FAILED    → tip added to netAmount; admin re-triggers the payout.
      //   • none      → warn — admin investigation (no assignment at completion).
      //   • CANCELLED → skip (delivery money was cancelled).
      try {
        const payout = await this.prisma.driverPayout.findUnique({
          where: { deliveryId },
        });
        if (payout && payout.status === "ELIGIBLE") {
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
        } else if (payout && payout.status === "PAID") {
          const adjustment = await this.prisma.driverPayoutAdjustment.create({
            data: {
              driverId: payout.driverId,
              deliveryId,
              originalPayoutId: payout.id,
              amount: Number(tip.amount.toFixed(2)),
              reason: "TIP",
              status: "PENDING",
              note: `Late tip on already-paid payout — pays out on the driver's next payout rail (event ${creditedEventId})`,
            },
          });
          this.logger.log(
            `Tip $${Number(tip.amount).toFixed(2)} on ALREADY-PAID payout for delivery ` +
            `${deliveryId} — created TIP adjustment ${adjustment.id} (pays on next payout)`,
          );
        } else if (payout && payout.status === "FAILED") {
          const newNet = Number(
            (Number(payout.netAmount) + Number(tip.amount)).toFixed(2),
          );
          await this.prisma.driverPayout.update({
            where: { id: payout.id },
            data: { netAmount: newNet },
          });
          this.logger.log(
            `Tip $${Number(tip.amount).toFixed(2)} added to FAILED payout ${payout.id} for ` +
            `delivery ${deliveryId} — will be included when the payout is re-triggered`,
          );
        } else if (!payout) {
          this.logger.warn(
            `Tip captured for delivery ${deliveryId} but no DriverPayout exists — ` +
            `admin must credit the driver manually (tip $${Number(tip.amount).toFixed(2)})`,
          );
        }
      } catch (payoutErr: any) {
        // Don't fail the webhook over a payout update issue — the tip
        // capture itself already succeeded. Admin can manually adjust.
        this.logger.error(
          `Failed to credit tip to driver payout for delivery ${deliveryId}: ${payoutErr?.message}`,
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

    // ── Defensive: un-cancel delivery if payment succeeded after a timeout ──
    // If the API call timed out during delivery creation, the delivery was
    // marked CANCELLED. But the charge actually succeeded on Stripe's side —
    // we just didn't receive the response. This webhook confirms it.
    // Un-cancel the delivery and list it so the dealer gets their delivery
    // back without having to retry. This handles the 0.01% timeout case
    // without needing a PENDING state.
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true },
    });
    if (delivery?.status === 'CANCELLED') {
      await this.prisma.deliveryRequest.update({
        where: { id: deliveryId },
        data: { status: 'LISTED' as any },
      });
      this.logger.log(
        `Un-cancelled delivery ${deliveryId} — payment succeeded via webhook after API timeout`,
      );
      // Create a status history entry for audit
      await this.prisma.deliveryStatusHistory.create({
        data: {
          deliveryId,
          actorType: 'SYSTEM' as any,
          fromStatus: 'CANCELLED' as any,
          toStatus: 'LISTED' as any,
          note: 'Payment confirmed by Stripe webhook after API timeout — delivery auto-recovered',
        },
      });
    }

    // Webhook CAPTURE event. De-dup is DB-enforced (see
    // createPaymentEventIdempotent): stripeEventId unique handles Stripe
    // replays, and the payment_event_capture_provider_unique partial index
    // (migration 20261008120000) drops duplicates when an in-process path
    // (private instant capture, lock-in fee, remainder capture) already
    // recorded this capture. The write must STAY as the safety net for the
    // paths where the webhook is the only confirmation (e.g. creation API
    // timed out but the charge succeeded).
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

    // Terminal-state guard: the charge already went through (or the money
    // left the PI lifecycle) — a late/redelivered failure event must NOT
    // regress it to FAILED, write a false FAIL PaymentEvent, or send the
    // customer a scary "payment failed" email for money we already hold.
    if (PAYMENT_TERMINAL_STATUSES.includes(payment.status)) {
      this.logger.warn(
        `payment_intent.failed for delivery ${deliveryId} ignored — payment already ${payment.status} (terminal); not regressing`,
      );
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

    // Terminal-state guard: money already moved — a redelivered canceled
    // event must not VOID a CAPTURED/REFUNDED payment out of existence.
    if (PAYMENT_TERMINAL_STATUSES.includes(payment.status)) {
      this.logger.warn(
        `payment_intent.canceled for delivery ${deliveryId} ignored — payment already ${payment.status} (terminal); not voiding`,
      );
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

  /**
   * `charge.refunded` webhook — refund state transition DELEGATED to
   * RefundSyncService (Task 19). The service is shared with the refund
   * reconciliation sweep so both paths apply the IDENTICAL transition:
   * Payment refund fields, proportional driver clawback, timeline row
   * (upgrading the admin endpoint's PROCESSING row), and the admin
   * "Refund completed" notification.
   */
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

    if (!this.refundSync) {
      this.logger.error(
        "RefundSyncService unavailable — charge.refunded state transition skipped",
      );
      return;
    }

    await this.refundSync.applyRefundState({
      payment,
      charge,
      stripeEventId,
      source: "webhook",
    });
  }

  // ── Platform bank payouts (Task 19) ───────────────────────────────
  //
  // `payout.paid` / `payout.failed` = Stripe moving PLATFORM money to the
  // company bank account (the automatic payout schedule, or a manual
  // payout). This rail was previously invisible to the app — the exact
  // reason the weekly driver sweep could hit "insufficient funds" without
  // anyone being told why. Requires the two events to be enabled on the
  // Stripe webhook endpoint (see docs/stripe-live-checklist.md).
  private async handlePlatformPayoutUpdate(payout: any, status: "PAID" | "FAILED") {
    this.logger.log(
      `Platform payout ${payout.id} ${status}: ${payout.amount / 100} ${payout.currency}`,
    );

    if (!this.notificationEngine) return;
    try {
      await this.notificationEngine.notifyAdminsPlatformPayout({
        payoutId: payout.id,
        status,
        amount: payout.amount / 100,
        currency: payout.currency || "usd",
        method: payout.type === "card" ? "card" : "bank account",
        arrivalDate: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString().slice(0, 10)
          : null,
        failureMessage: payout.failure_message ?? null,
        automatic: payout.automatic ?? null,
      });
    } catch (err: any) {
      // Non-fatal — the payout itself already happened/didn't on Stripe's side.
      this.logger.error(
        `Failed platform-payout admin notification for ${payout.id} (non-fatal): ${err.message}`,
      );
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
    //
    // We do this in a transaction with the clawback creation so they're
    // atomic — no half-state where the Payment is REFUNDED but the
    // clawback row is missing.
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
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

      // ── Fix #6: Create clawback for the dispute amount ──
      // Same logic as refund clawback — driver's payout should be
      // reduced proportionally. The reversal (if dispute is won) is
      // handled in handleChargeDisputeClosed.
      if (disputedAmountCents > 0) {
        if (!this.refundSync) {
          // Loud but non-fatal: the dispute itself still needs recording.
          this.logger.error(
            "RefundSyncService unavailable — DISPUTE clawback SKIPPED (admin must adjust driver payout manually)",
          );
        } else {
          try {
            await this.refundSync.createDriverPayoutClawback(tx, {
              paymentId: payment.id,
              refundAmountCents: disputedAmountCents,
              reason: "DISPUTE",
              stripeEventId,
            });
          } catch (err: any) {
            // P2002 on stripeEventId = duplicate webhook — safe to ignore
            if (
              err?.code === "P2002" &&
              Array.isArray(err?.meta?.target) &&
              err.meta.target.includes("stripeEventId")
            ) {
              this.logger.log(
                `DriverPayoutAdjustment for dispute ${dispute.id} already exists (idempotent)`,
              );
            } else {
              throw err;
            }
          }
        }
      }
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
      // Revert Payment back to CAPTURED + reverse the clawback adjustment
      // (so the driver gets their payout back, since the platform got paid).
      //
      // We do this in a transaction so the Payment update + adjustment
      // reversal are atomic. If either fails, the whole thing rolls back.
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
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

        // ── Reverse the DriverPayoutAdjustment created on dispute ──
        // Find the original clawback adjustment that was created when
        // the dispute was opened. If it's PENDING, mark it REVERSED so
        // it doesn't get applied to the driver's next payout. If it's
        // already APPLIED, create a POSITIVE reversal adjustment so the
        // driver gets their money back on their NEXT payout.
        //
        // We look up the adjustment by stripeEventId of the dispute.created
        // event — but we don't have that here, so we look up by paymentId
        // + reason='DISPUTE' + status in (PENDING, APPLIED).
        //
        // If no adjustment is found (e.g. the payout didn't exist when
        // the dispute was opened, so no clawback was created), we skip
        // the reversal — nothing to reverse.
        const originalAdjustment = await tx.driverPayoutAdjustment.findFirst({
          where: {
            paymentId: payment.id,
            reason: 'DISPUTE',
            status: { in: ['PENDING', 'APPLIED'] },
          },
          select: { id: true, amount: true, driverId: true, status: true },
        });

        if (originalAdjustment) {
          if (originalAdjustment.status === 'PENDING') {
            // Still PENDING — just mark as REVERSED. The driver never
            // saw the deduction.
            await tx.driverPayoutAdjustment.update({
              where: { id: originalAdjustment.id },
              data: { status: 'REVERSED' },
            });
            this.logger.log(
              `Dispute won — reversed PENDING clawback ${originalAdjustment.id} ` +
              `(driver ${originalAdjustment.driverId} never saw the deduction)`,
            );
          } else {
            // Already APPLIED — the driver already lost money. Create
            // a POSITIVE reversal adjustment so the driver gets it back
            // on their next payout.
            const reversalAmount = -Number(originalAdjustment.amount); // flip sign
            await tx.driverPayoutAdjustment.create({
              data: {
                driverId: originalAdjustment.driverId,
                deliveryId: payment.deliveryId,
                paymentId: payment.id,
                originalPayoutId: null,
                amount: reversalAmount, // positive = refund to driver
                reason: 'DISPUTE_WON_REVERSAL',
                status: 'PENDING',
                reversalOfAdjustmentId: originalAdjustment.id,
                stripeEventId, // idempotent — duplicate webhook won't create a second reversal
                note: `Reversal of clawback ${originalAdjustment.id} — dispute won, customer's charge reinstated`,
              },
            });
            // Mark the original as REVERSED (it can't be re-applied)
            await tx.driverPayoutAdjustment.update({
              where: { id: originalAdjustment.id },
              data: { status: 'REVERSED' },
            });
            this.logger.log(
              `Dispute won — created POSITIVE reversal adjustment for driver ${originalAdjustment.driverId} ` +
              `(+ $${reversalAmount.toFixed(2)} on next payout)`,
            );
          }
        } else {
          this.logger.log(
            `Dispute won — no original clawback adjustment found for payment ${payment.id} ` +
            `(payout may not have existed at dispute time — nothing to reverse)`,
          );
        }
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
        // Set as default payment method in OUR DB
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { stripeDefaultPaymentMethodId: paymentMethodId },
        });
        this.logger.log(
          `Set DB default payment method ${paymentMethodId} for customer ${customer.id}`,
        );

        // ── Fix 1: Also set Stripe's invoice_settings.default_payment_method ──
        // This is the field Stripe uses for postpaid weekly invoice charges.
        // Without this, the dealer saves a new card in our DB but Stripe
        // keeps charging the OLD card for weekly invoices.
        //
        // This is the critical fix for the "frozen dealer replaces card"
        // flow: after this update, the daily cron's invoice retry uses
        // the NEW card → invoice succeeds → webhook auto-unfreezes.
        //
        // Verify-after-write (B1): set the default, then read the customer
        // back and CONFIRM it stuck. If the update fails or the value doesn't
        // match, we THROW — the webhook controller turns that into a 500 and
        // Stripe redelivers the event, so the write is retried instead of
        // silently drifting (our DB says "default card X", Stripe says
        // "no default" → weekly invoices 402 with code=missing).
        // The handler is fully idempotent, so Stripe's redelivery is safe.
        try {
          await this.stripeService.stripe.customers.update(
            customerId,
            { invoice_settings: { default_payment_method: paymentMethodId } },
          );
        } catch (stripeErr: any) {
          throw new Error(
            `Failed to set Stripe invoice_settings.default_payment_method for customer ${customerId}: ${stripeErr.message} — failing webhook so Stripe redelivers`,
          );
        }

        const refreshed = await this.stripeService.stripe.customers.retrieve(customerId);
        const raw = (refreshed as any).invoice_settings?.default_payment_method;
        const appliedDefault = typeof raw === "string" ? raw : raw?.id;
        if (appliedDefault !== paymentMethodId) {
          throw new Error(
            `Stripe invoice_settings.default_payment_method did not stick for customer ${customerId} (expected ${paymentMethodId}, got ${appliedDefault ?? "null"}) — failing webhook so Stripe redelivers`,
          );
        }
        this.logger.log(
          `Set Stripe invoice_settings.default_payment_method ${paymentMethodId} for Stripe customer ${customerId} (verified by re-read)`,
        );

        // ── Pay-kick (B3): the dealer just got a WORKING default card.
        // If they have open (failed) weekly invoices, charge them NOW —
        // "save card → paid → auto-unfrozen" lands in seconds instead of
        // waiting for the next hourly retry cron. Fire-and-forget: the card
        // save itself is fully processed, so a kick failure must NOT fail
        // this webhook (the hourly cron remains the fallback). Safe to run
        // alongside the cron — retryAllFailedCharges lists open invoices
        // fresh and only pays still-open ones.
        if (this.postpaidBilling) {
          void this.postpaidBilling
            .retryAllFailedCharges(customer.id)
            .then((result) => {
              if (result.invoicesRetried > 0) {
                this.logger.log(
                  `Card-save pay-kick for dealer ${customer.id}: ${result.succeeded}/${result.invoicesRetried} open invoice(s) paid${result.skippedNoCard ? `, ${result.skippedNoCard} skipped (no card)` : ""}`,
                );
              }
            })
            .catch((kickErr: any) => {
              this.logger.warn(
                `Card-save pay-kick for dealer ${customer.id} failed (hourly cron will retry): ${kickErr?.message}`,
              );
            });
        }
      } else {
        this.logger.warn(
          `No Customer record found for Stripe customer ${customerId}`,
        );
      }
    } catch (err: any) {
      // Rethrow (B1): the webhook controller's outer catch answers 500 and
      // Stripe redelivers the event. Swallowing here would leave the DB
      // default set while Stripe's invoice default silently drifted.
      this.logger.error(
        `Failed to process SetupIntent ${setupIntent.id}: ${err.message} — rethrowing so Stripe redelivers`,
      );
      throw err;
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
      // P2002 (unique violation) = duplicate — on this table every unique
      // constraint is a legitimate duplicate signal, not an error:
      //   • stripeEventId unique — the same Stripe event was already processed
      //   • payment_event_capture_provider_unique (partial index, migration
      //     20261008120000) — an in-process writer already recorded this
      //     capture (providerRef = PI / charge ref). The DB decides, so
      //     concurrent writers (creation path vs webhook on another worker)
      //     can never both land — no check-then-insert race possible.
      if (err?.code === "P2002") {
        this.logger.log(
          `Duplicate PaymentEvent for payment ${input.paymentId} (unique target: ${JSON.stringify(
            err?.meta?.target ?? [],
          )}) — skipping insert`,
        );
        return;
      }
      throw err;
    }
  }
}

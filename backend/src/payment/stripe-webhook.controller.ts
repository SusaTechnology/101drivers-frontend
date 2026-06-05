import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  HttpCode,
} from "@nestjs/common";
import { Request, Response } from "express";
import { StripeService } from "../providers/stripe/stripe.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("stripe")
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
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
      event = this.stripeService.verifyWebhookEvent(
        req.body,
        signature,
      );
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        case "payment_intent.canceled":
          await this.handlePaymentIntentCanceled(event.data.object);
          break;

        case "charge.refunded":
          await this.handleChargeRefunded(event.data.object);
          break;

        case "transfer.created":
          await this.handleTransferCreated(event.data.object);
          break;

        case "transfer.paid":
          await this.handleTransferPaid(event.data.object);
          break;

        case "transfer.failed":
          await this.handleTransferFailed(event.data.object);
          break;

        case "account.updated":
          await this.handleAccountUpdated(event.data.object);
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

  private async handlePaymentIntentSucceeded(pi: any) {
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

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "CAPTURE",
        status: "CAPTURED",
        amount: pi.amount / 100,
        message: "Payment succeeded via webhook",
        providerRef: pi.id,
        raw: pi as any,
      },
    });

    this.logger.log(`Payment captured for delivery ${deliveryId} (PI: ${pi.id})`);
  }

  private async handlePaymentIntentFailed(pi: any) {
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

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "FAIL",
        status: "FAILED",
        amount: pi.amount / 100,
        message: pi.last_payment_error?.message || "Payment failed",
        providerRef: pi.id,
        raw: pi as any,
      },
    });

    this.logger.warn(`Payment failed for delivery ${deliveryId}: ${pi.last_payment_error?.message}`);
  }

  private async handlePaymentIntentCanceled(pi: any) {
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

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "VOID",
        status: "VOIDED",
        message: "PaymentIntent cancelled via Stripe webhook",
        providerRef: pi.id,
        raw: pi as any,
      },
    });

    this.logger.log(`Payment voided for delivery ${deliveryId} (PI: ${pi.id})`);
  }

  private async handleChargeRefunded(charge: any) {
    // Find the payment by providerChargeId
    const payment = await this.prisma.payment.findFirst({
      where: { providerChargeId: charge.id },
    });
    if (!payment) {
      this.logger.warn(`Refund for unknown charge: ${charge.id}`);
      return;
    }

    const isFullRefund = charge.amount_refunded === charge.amount;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isFullRefund ? "REFUNDED" : "CAPTURED",
        providerChargeId: charge.id,
      },
    });

    await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "REFUND",
        status: "REFUNDED",
        amount: charge.amount_refunded / 100,
        message: `Refund ${isFullRefund ? "full" : "partial"}`,
        providerRef: charge.refunds?.data?.[0]?.id,
        raw: charge as any,
      },
    });

    this.logger.log(`Refund processed for payment ${payment.id}`);
  }

  private async handleTransferCreated(transfer: any) {
    this.logger.log(`Transfer created: ${transfer.id} → ${transfer.destination} ($${transfer.amount / 100})`);
  }

  private async handleTransferPaid(transfer: any) {
    // Update payout record when transfer completes
    const payoutId = transfer.metadata?.payoutId;
    if (payoutId) {
      await this.prisma.driverPayout.update({
        where: { id: payoutId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          providerTransferId: transfer.id,
        },
      });
      this.logger.log(`Payout ${payoutId} paid via transfer ${transfer.id}`);
    }
  }

  private async handleTransferFailed(transfer: any) {
    const payoutId = transfer.metadata?.payoutId;
    if (payoutId) {
      await this.prisma.driverPayout.update({
        where: { id: payoutId },
        data: { status: "FAILED" },
      });
      this.logger.warn(`Payout ${payoutId} failed via transfer ${transfer.id}`);
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
}

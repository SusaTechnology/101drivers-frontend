import { Controller, Get, Post, Param, Body, Logger, UseGuards, NotFoundException, BadRequestException } from "@nestjs/common";
import { StripeService } from "../providers/stripe/stripe.service";
import { PrismaService } from "../prisma/prisma.service";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import * as nestAccessControl from "nest-access-control";

@Controller("payments")
export class StripePaymentController {
  private readonly logger = new Logger(StripePaymentController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get Stripe publishable key for the frontend.
   * Public endpoint — needed to initialize Stripe.js.
   */
  @Get("stripe/config")
  getStripeConfig() {
    return {
      publishableKey: this.stripeService.publishableKey,
    };
  }

  /**
   * Get or create a PaymentIntent for a delivery.
   * If a PaymentIntent already exists for this delivery, return its clientSecret.
   */
  @Post("stripe/payment-intent/:deliveryId")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async getOrCreatePaymentIntent(@Param("deliveryId") deliveryId: string) {
    // Check if a PaymentIntent already exists for this delivery
    const payment = await this.prisma.payment.findUnique({
      where: { deliveryId },
    });

    if (payment?.providerPaymentIntentId) {
      const pi = await this.stripeService.getPaymentIntent(payment.providerPaymentIntentId);

      // Terminal statuses that cannot be reused for Elements
      const terminalStatuses = ['succeeded', 'canceled', 'cancelled'];
      if (!terminalStatuses.includes(pi.status)) {
        return {
          paymentIntentId: pi.id,
          clientSecret: pi.client_secret,
          status: pi.status,
          amount: pi.amount / 100,
        };
      }

      // PaymentIntent is terminal — fall through to create a new one
      this.logger.log(`Existing PaymentIntent ${pi.id} is in terminal state (${pi.status}), creating a new one`);
    }

    // Create a new PaymentIntent
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true, quote: { select: { estimatedPrice: true } } },
    });

    if (!delivery) {
      return { error: "Delivery not found" };
    }

    try {
      const result = await this.stripeService.createPaymentIntent({
        amount: delivery.quote?.estimatedPrice || 0,
        deliveryId,
        captureMethod: 'manual', // Hold funds, capture on delivery completion
      });

      // Update the payment record with the new PaymentIntent
      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            provider: "STRIPE",
            providerPaymentIntentId: result.paymentIntentId,
          },
        });
      } else {
        // No payment record yet — create one
        await this.prisma.payment.create({
          data: {
            deliveryId,
            amount: delivery.quote?.estimatedPrice || 0,
            provider: "STRIPE",
            providerPaymentIntentId: result.paymentIntentId,
            paymentType: "PREPAID",
            status: "AUTHORIZED",
          },
        });
      }

      return {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        status: "requires_payment_method",
        amount: delivery.quote?.estimatedPrice || 0,
      };
    } catch (err: any) {
      this.logger.error(`PaymentIntent creation failed: ${err.message}`);
      return { error: "Failed to create payment intent", details: err.message };
    }
  }

  /**
   * Create a PaymentIntent for a tip on a completed delivery.
   * The tip amount comes from the frontend body.
   */
  @Post("stripe/tip-intent")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async createTipPaymentIntent(
    @Body() body: { deliveryId: string; amount: number },
  ) {
    const { deliveryId, amount } = body;

    if (!deliveryId || !amount || amount <= 0) {
      return { error: "Invalid delivery ID or tip amount" };
    }

    if (amount > 500) {
      return { error: "Tip amount cannot exceed $500" };
    }

    // Verify delivery exists and is completed
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true, status: true },
    });

    if (!delivery) {
      return { error: "Delivery not found" };
    }

    if (delivery.status !== "COMPLETED") {
      return { error: "Tips can only be added to completed deliveries" };
    }

    // Check if a tip already exists for this delivery
    const existingTip = await this.prisma.tip.findUnique({
      where: { deliveryId },
    });

    if (existingTip?.providerRef) {
      // Check if the existing tip PaymentIntent is terminal
      try {
        const pi = await this.stripeService.getPaymentIntent(existingTip.providerRef);
        const terminalStatuses = ['succeeded', 'canceled', 'cancelled'];
        if (!terminalStatuses.includes(pi.status)) {
          return {
            paymentIntentId: pi.id,
            clientSecret: pi.client_secret,
            status: pi.status,
            amount: pi.amount / 100,
          };
        }
      } catch {
        // PaymentIntent not found or API error — fall through and create new one
      }
    }

    try {
      const result = await this.stripeService.createPaymentIntent({
        amount,
        deliveryId,
        metadata: { type: "tip" },
        captureMethod: 'automatic', // Tips charge immediately (post-completion)
      });

      // Upsert tip record
      if (existingTip) {
        await this.prisma.tip.update({
          where: { deliveryId },
          data: {
            amount,
            provider: "STRIPE",
            providerRef: result.paymentIntentId,
            status: "AUTHORIZED",
          },
        });
      } else {
        await this.prisma.tip.create({
          data: {
            amount,
            deliveryId,
            provider: "STRIPE",
            providerRef: result.paymentIntentId,
            status: "AUTHORIZED",
          },
        });
      }

      return {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        status: "requires_payment_method",
        amount,
      };
    } catch (err: any) {
      this.logger.error(`Tip PaymentIntent creation failed: ${err.message}`);
      return { error: "Failed to create tip payment intent", details: err.message };
    }
  }

  /**
   * Issue a full refund for a captured/paid payment via Stripe.
   * Admin-only action.
   */
  @Post("stripe/refund/:paymentId")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async refundPayment(
    @Param("paymentId") paymentId: string,
    @Body() body?: { note?: string },
  ) {
    // 1. Fetch the payment record
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // 2. Validate status — only CAPTURED or PAID can be refunded
    if (!['CAPTURED', 'PAID'].includes(payment.status)) {
      throw new BadRequestException(
        `Cannot refund payment in ${payment.status} status. Only CAPTURED or PAID payments can be refunded.`,
      );
    }

    if (!payment.providerPaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe PaymentIntent reference.');
    }

    try {
      // 3. Retrieve the PaymentIntent to get the latest charge
      const pi = await this.stripeService.getPaymentIntent(payment.providerPaymentIntentId);

      // PaymentIntent must have a charge to refund
      const charge = pi.latest_charge;
      if (!charge) {
        throw new BadRequestException(
          'No charge found on this PaymentIntent. Nothing to refund.',
        );
      }

      // 4. Issue full refund via Stripe
      const refund = await this.stripeService.createRefund({
        chargeId: typeof charge === 'string' ? charge : (charge as any).id,
        reason: 'requested_by_customer',
        metadata: {
          paymentId,
          deliveryId: payment.deliveryId,
          adminNote: body?.note || 'Full refund processed by admin',
        },
      });

      this.logger.log(
        `Refund created: ${refund.id} for charge ${charge} on payment ${paymentId}`,
      );

      // 5. Update payment status to REFUNDED
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });

      // 6. Create PaymentEvent audit record
      await this.prisma.paymentEvent.create({
        data: {
          paymentId,
          type: 'REFUND',
          status: 'REFUNDED',
          amount: payment.amount,
          message: body?.note || 'Full refund processed by admin',
          providerRef: refund.id,
          raw: refund as any,
        },
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount ? refund.amount / 100 : payment.amount,
        paymentStatus: 'REFUNDED',
      };
    } catch (err: any) {
      this.logger.error(`Refund failed for payment ${paymentId}: ${err.message}`);
      throw new BadRequestException(
        `Refund failed: ${err.message}`,
      );
    }
  }
}

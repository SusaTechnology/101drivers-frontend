import { Controller, Get, Post, Param, Body, Logger, UseGuards } from "@nestjs/common";
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
}

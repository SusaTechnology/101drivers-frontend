import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  public readonly stripe: ReturnType<typeof Stripe>;
  public readonly publishableKey: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
    const apiVersion = Stripe.API_VERSION as any;
    if (!secretKey) {
      this.logger.error(
        "STRIPE_SECRET_KEY is not configured. Stripe API calls will fail. " +
        "Set STRIPE_SECRET_KEY in your environment to enable payments.",
      );
      this.stripe = new Stripe("sk_test_placeholder", {
        apiVersion,
        typescript: true,
      });
      this.publishableKey = "";
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion,
        typescript: true,
      });
      this.publishableKey = this.configService.get<string>("STRIPE_PUBLISHABLE_KEY") || "";
    }
  }

  // ── Payment Intents ──────────────────────────────────────────────

  /**
   * Create a PaymentIntent for a delivery.
   * Returns the clientSecret for the frontend to use.
   */
  async createPaymentIntent(params: {
    amount: number; // in dollars, e.g. 150.00
    deliveryId: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
    /**
     * capture_method:
     *  - 'manual' — funds held (authorized) but not charged until you call capturePaymentIntent()
     *  - 'automatic' (default) — funds charged immediately when customer confirms
     */
    captureMethod?: 'manual' | 'automatic';
  }): Promise<{ paymentIntentId: string; clientSecret: string }> {
    // Stripe expects amount in cents
    const amountCents = Math.round(params.amount * 100);

    const idempotencyKey = `pi-${params.deliveryId}-${params.captureMethod || 'auto'}-${Math.floor(Date.now() / 60000)}`;

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        capture_method: params.captureMethod || "automatic",
        metadata: {
          deliveryId: params.deliveryId,
          ...params.metadata,
        },
        ...(params.customerEmail
          ? { receipt_email: params.customerEmail }
          : {}),
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey },
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }

  /**
   * Capture a previously created PaymentIntent.
   * Called when delivery is completed.
   */
  async capturePaymentIntent(
    paymentIntentId: string,
    options?: { idempotencyKey?: string },
  ) {
    const requestOptions = options?.idempotencyKey
      ? { idempotencyKey: options.idempotencyKey }
      : {};
    return this.stripe.paymentIntents.capture(paymentIntentId, {}, requestOptions);
  }

  /**
   * Cancel (void) a PaymentIntent.
   */
  async cancelPaymentIntent(paymentIntentId: string) {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Get a PaymentIntent by ID.
   */
  async getPaymentIntent(paymentIntentId: string) {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  // ── Refunds ──────────────────────────────────────────────────────

  /**
   * Create a full or partial refund for a charge.
   */
  async createRefund(params: {
    chargeId: string;
    amount?: number; // in dollars — omit for full refund
    reason?: string;
    metadata?: Record<string, string>;
  }) {
    const idempotencyKey = `refund-${params.chargeId}-${Date.now()}`;
    return this.stripe.refunds.create(
      {
        charge: params.chargeId,
        ...(params.amount ? { amount: Math.round(params.amount * 100) } : {}),
        ...(params.reason ? { reason: params.reason as any } : {}),
        metadata: params.metadata,
      },
      { idempotencyKey },
    );
  }

  // ── Transfers (Connect) ──────────────────────────────────────────

  /**
   * Transfer money to a Stripe Connected Account (driver payout).
   * Used when a driver's Stripe Connect account is set up.
   */
  async createTransfer(params: {
    amount: number; // in dollars
    destinationAccountId: string;
    transferGroup?: string; // e.g., delivery ID for reconciliation
    metadata?: Record<string, string>;
  }) {
    const idempotencyKey = `transfer-${params.destinationAccountId}-${params.transferGroup || 'none'}-${Date.now()}`;
    return this.stripe.transfers.create(
      {
        amount: Math.round(params.amount * 100), // cents
        currency: "usd",
        destination: params.destinationAccountId,
        ...(params.transferGroup ? { transfer_group: params.transferGroup } : {}),
        metadata: params.metadata,
      },
      { idempotencyKey },
    );
  }

  // ── Connect Onboarding ───────────────────────────────────────────

  /**
   * Create an Account Link for Stripe Connect onboarding.
   * The driver opens this URL to complete KYC + bank setup.
   */
  async createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }) {
    return this.stripe.accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: "account_onboarding",
    });
  }

  /**
   * Create a Stripe Connect account for a driver.
   */
  async createConnectAccount(params: {
    email: string;
    driverId: string;
    country?: string;
  }) {
    return this.stripe.accounts.create({
      type: "express",
      country: params.country || "US",
      email: params.email,
      metadata: { driverId: params.driverId },
      capabilities: {
        transfers: { requested: true },
      },
    });
  }

  /**
   * Retrieve a Connect account.
   */
  async getConnectAccount(accountId: string) {
    return this.stripe.accounts.retrieve(accountId);
  }

  // ── Webhooks ─────────────────────────────────────────────────────

  /**
   * Verify and parse a Stripe webhook event.
   * Throws if signature is invalid.
   */
  verifyWebhookEvent(rawBody: string, signature: string) {
    const webhookSecret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}

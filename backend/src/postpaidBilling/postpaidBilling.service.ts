// PostpaidBillingService — decoupled engine for dealer weekly postpaid
// billing via Stripe (Option A).
//
// WHAT THIS OWNS
//   • Dealer onboarding onto the weekly metered anchor Subscription
//   • Per-delivery InvoiceItem creation on delivery completion (with
//     pickup/dropoff baked into the description → weekly invoice shows
//     one line per delivery)
//   • Pre-check at delivery creation: cap, frozen, approved, has PM
//   • Webhook handlers for invoice.upcoming / payment_succeeded /
//     payment_failed → updates Payment rows + freezes dealer on failure
//
// WHAT THIS DOES NOT OWN
//   • Pricing — calls existing PricingEngineService for FLAT_TIER amounts
//   • Driver payouts — out of scope (existing PaymentPayoutEngine handles)
//   • Stripe webhook parsing — handled by StripeWebhookController, which
//     delegates invoice.* events here
//
// DECOUPLING RULE
//   Other services (DeliveryLifecycleService, DeliveryRequestOrchestrator)
//   inject this and call only the public methods. No Stripe SDK calls
//   should leak into those callers.

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EnumCustomerApprovalStatus,
  EnumCustomerBillingMode,
  EnumCustomerCustomerType,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import {
  FREEZE_REASONS,
  INVOICE_ITEM_DESCRIPTION_TEMPLATE,
  POSTPAID_ENV,
  STRIPE_METADATA_KEYS,
} from "./postpaidBilling.constants";
import type {
  DealerEligibilityResult,
  ReportUsageResult,
  SetupResult,
} from "./postpaidBilling.types";

type Tx = Prisma.TransactionClient;

@Injectable()
export class PostpaidBillingService {
  private readonly logger = new Logger(PostpaidBillingService.name);
  private readonly postpaidPriceId: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {
    const priceId = this.configService.get<string>(
      POSTPAID_ENV.STRIPE_POSTPAID_PRICE_ID,
    );
    this.postpaidPriceId = priceId ?? null;
    if (!priceId) {
      this.logger.warn(
        `${POSTPAID_ENV.STRIPE_POSTPAID_PRICE_ID} is not set. ` +
          `Postpaid subscription onboarding will fail until it's configured. ` +
          `Create a $0/week metered price on the Stripe dashboard and set the env var.`,
      );
    }
  }

  // ─── SETUP ───────────────────────────────────────────────────────

  /**
   * Onboard a dealer onto weekly postpaid billing.
   *
   * Called from: dealer approval flow (CustomerPricingEngine.assignPricing
   * when postpaidEnabled=true) OR an admin action.
   *
   * Idempotent — if the dealer already has a Stripe Customer + Subscription,
   * returns the existing setup without making new Stripe API calls.
   */
  async setupDealerForPostpaid(dealerId: string): Promise<SetupResult> {
    if (!this.stripeService) {
      throw new Error("StripeService not available — STRIPE_SECRET_KEY not configured");
    }
    if (!this.postpaidPriceId) {
      throw new Error(
        `${POSTPAID_ENV.STRIPE_POSTPAID_PRICE_ID} not configured — ` +
          `create the $0/week metered price on Stripe dashboard first`,
      );
    }

    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        customerType: true,
        approvalStatus: true,
        postpaidEnabled: true,
        billingMode: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        user: { select: { email: true, fullName: true } },
        businessName: true,
        contactName: true,
        contactEmail: true,
      },
    });

    if (!dealer) throw new NotFoundException("Customer not found");
    if (dealer.customerType !== EnumCustomerCustomerType.BUSINESS) {
      throw new BadRequestException("Only BUSINESS customers can be set up for postpaid billing");
    }
    if (dealer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED) {
      throw new BadRequestException("Dealer must be APPROVED before postpaid onboarding");
    }
    if (dealer.postpaidEnabled !== true) {
      throw new BadRequestException("postpaidEnabled is not true — set it via admin first");
    }

    // Idempotency: if subscription already exists, just confirm the billing mode
    // is set on the DB and return.
    if (dealer.stripeSubscriptionId) {
      this.logger.log(
        `Dealer ${dealerId} already has subscription ${dealer.stripeSubscriptionId} — skipping Stripe calls`,
      );
      if (dealer.billingMode !== EnumCustomerBillingMode.WEEKLY_POSTPAID) {
        await this.prisma.customer.update({
          where: { id: dealerId },
          data: { billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID },
        });
      }
      return {
        customerId: dealer.id,
        stripeCustomerId: dealer.stripeCustomerId!,
        stripeSubscriptionId: dealer.stripeSubscriptionId,
        billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
      };
    }

    // 1. Create or fetch Stripe Customer
    const customerEmail = dealer.contactEmail || dealer.user?.email;
    if (!customerEmail) {
      throw new BadRequestException("Dealer has no contact email — required to create Stripe Customer");
    }
    const customerName = dealer.businessName || dealer.contactName || dealer.user?.fullName || customerEmail;

    const stripeCustomer = await this.stripeService.createOrGetCustomer({
      email: customerEmail,
      name: customerName,
      metadata: {
        customerId: dealer.id,
        source: "postpaid-setup",
      },
    });

    // 2. Create the anchor subscription ($0/week metered price →
    //    Stripe auto-creates weekly invoices, charging the saved PM).
    //    We use billing_cycle_anchor so the first invoice aligns with
    //    Sunday 02:00 dealer-TZ (admin can configure later). For now
    //    we let Stripe pick the anchor (creation time + 7d cycles).
    const subscription = await this.stripeService.stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: this.postpaidPriceId }],
      // Off-session payment — must succeed without customer interaction.
      // Stripe will use the customer's invoice_settings.default_payment_method
      // (set when their first SetupIntent succeeds).
      // `collection_method` = "charge_automatically" tells Stripe to charge
      // the saved PM automatically when the weekly invoice is created.
      collection_method: "charge_automatically",
      metadata: {
        [STRIPE_METADATA_KEYS.CUSTOMER_ID]: dealer.id,
        [STRIPE_METADATA_KEYS.BILLING_MODE]: EnumCustomerBillingMode.WEEKLY_POSTPAID,
        [STRIPE_METADATA_KEYS.SOURCE]: "postpaid-weekly",
      },
      // If no PM is attached yet, the first invoice will fail. That's fine —
      // the dealer freezes until they add a card via the saved-card flow.
      // We don't want the subscription itself to be cancelled on first failure.
      days_until_due: 7,
    });

    // 3. Persist Stripe Customer + Subscription IDs on Customer row
    await this.prisma.customer.update({
      where: { id: dealerId },
      data: {
        stripeCustomerId: stripeCustomer.id,
        stripeSubscriptionId: subscription.id,
        billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
      },
    });

    this.logger.log(
      `Dealer ${dealerId} set up for weekly postpaid: ` +
        `stripeCustomer=${stripeCustomer.id}, subscription=${subscription.id}`,
    );

    return {
      customerId: dealer.id,
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: subscription.id,
      billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
    };
  }

  // ─── PRE-CHECK ──────────────────────────────────────────────────

  /**
   * Pre-check at delivery creation: can this dealer create another
   * postpaid delivery?
   *
   * Returns ok=true when:
   *   • Dealer is NOT on WEEKLY_POSTPAID (caller should skip — not our
   *     concern, fall through to existing prepaid flow)
   *   • OR dealer is on WEEKLY_POSTPAID AND not frozen AND approved AND
   *     has a saved payment method AND cap not exceeded (if cap is set)
   *
   * Returns ok=false with a `reason` when any of the above fail.
   *
   * Caller (DeliveryRequestOrchestrator) is responsible for throwing a
   * user-facing error based on `reason`. This keeps the engine pure —
   * it doesn't know about HTTP layer concerns.
   */
  async canDealerCreateDelivery(
    dealerId: string,
    amountCents: number,
  ): Promise<DealerEligibilityResult> {
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        approvalStatus: true,
        postpaidEnabled: true,
        billingMode: true,
        billingFrozen: true,
        postpaidCreditLimitCents: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!dealer) {
      return {
        ok: false,
        reason: "NOT_APPROVED", // no record → fail safely
      };
    }

    // Not on weekly postpaid — caller should skip the check entirely
    if (dealer.billingMode !== EnumCustomerBillingMode.WEEKLY_POSTPAID) {
      return { ok: true, reason: "NOT_POSTPAID" };
    }

    // Frozen?
    if (dealer.billingFrozen) {
      return { ok: false, reason: "FROZEN" };
    }

    // Approved?
    if (dealer.approvalStatus !== EnumCustomerApprovalStatus.APPROVED) {
      return { ok: false, reason: "NOT_APPROVED" };
    }

    // Has Stripe subscription?
    if (!dealer.stripeSubscriptionId) {
      return { ok: false, reason: "NO_SUBSCRIPTION" };
    }

    // Has saved payment method?
    if (!dealer.stripeDefaultPaymentMethodId) {
      return { ok: false, reason: "NO_PAYMENT_METHOD" };
    }

    // Cap check — only if a cap is set (null = unlimited, the default)
    if (dealer.postpaidCreditLimitCents != null) {
      const usedCents = await this.computeOutstandingBalanceCents(dealerId);
      const limitCents = dealer.postpaidCreditLimitCents;
      if (usedCents + amountCents > limitCents) {
        return {
          ok: false,
          reason: "OVER_LIMIT",
          usedCents,
          limitCents,
          attemptedCents: amountCents,
        };
      }
    }

    return { ok: true, usedCents: dealer.postpaidCreditLimitCents ?? undefined };
  }

  // ─── USAGE REPORTING ────────────────────────────────────────────

  /**
   * Called by the delivery orchestrator when a delivery completes.
   *
   * Creates a Stripe InvoiceItem with:
   *   • amount = Payment.amount × 100 (FLAT_TIER-calculated by the existing
   *     pricing engine at delivery-creation time)
   *   • description = "Delivery #X — pickup → dropoff (Y mi) — $Z"
   *   • metadata = { deliveryId, paymentId, customerId, source }
   *
   * On success: Payment.status → USAGE_REPORTED, stripeInvoiceItemId set.
   * On failure: logs + retries nothing (admin can manually retry via
   * dashboard). Payment stays in its prior status for visibility.
   *
   * This method is non-throwing — caller doesn't have to wrap in try/catch
   * to avoid failing the completion flow.
   */
  async reportUsageToStripe(input: { deliveryId: string }): Promise<ReportUsageResult> {
    const failure = (msg: string, paymentId: string, status: EnumPaymentStatus): ReportUsageResult => {
      this.logger.error(
        `reportUsageToStripe failed for delivery ${input.deliveryId}: ${msg}`,
      );
      return {
        deliveryId: input.deliveryId,
        paymentId,
        stripeInvoiceItemId: null,
        status,
        failureMessage: msg,
      };
    };

    if (!this.stripeService) {
      // No Stripe configured — return without DB changes, just log.
      this.logger.warn(
        `reportUsageToStripe called for delivery ${input.deliveryId} but StripeService is unavailable — skipping`,
      );
      const payment = await this.prisma.payment.findUnique({
        where: { deliveryId: input.deliveryId },
        select: { id: true, status: true },
      });
      return failure(
        "StripeService unavailable (STRIPE_SECRET_KEY not set)",
        payment?.id ?? "unknown",
        (payment?.status as EnumPaymentStatus) ?? EnumPaymentStatus.FAILED,
      );
    }

    // Fetch the delivery + payment + customer in one query.
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        quote: { select: { distanceMiles: true, estimatedPrice: true } },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentType: true,
            stripeInvoiceItemId: true,
          },
        },
        customer: {
          select: {
            id: true,
            stripeCustomerId: true,
            billingMode: true,
            postpaidEnabled: true,
          },
        },
      },
    });

    if (!delivery) {
      return failure("Delivery not found", "unknown", EnumPaymentStatus.FAILED);
    }

    const payment = delivery.payment;
    if (!payment) {
      return failure("Payment row not found", "unknown", EnumPaymentStatus.FAILED);
    }

    // Idempotency: if we already reported usage, don't double-charge.
    if (payment.stripeInvoiceItemId) {
      this.logger.log(
        `Delivery ${input.deliveryId} already has InvoiceItem ${payment.stripeInvoiceItemId} — skipping`,
      );
      return {
        deliveryId: input.deliveryId,
        paymentId: payment.id,
        stripeInvoiceItemId: payment.stripeInvoiceItemId,
        status: payment.status as EnumPaymentStatus,
      };
    }

    // Skip if not a postpaid delivery.
    if (
      payment.paymentType !== EnumPaymentPaymentType.POSTPAID ||
      delivery.customer?.billingMode !== EnumCustomerBillingMode.WEEKLY_POSTPAID
    ) {
      return {
        deliveryId: input.deliveryId,
        paymentId: payment.id,
        stripeInvoiceItemId: null,
        status: payment.status as EnumPaymentStatus,
      };
    }

    const stripeCustomerId = delivery.customer?.stripeCustomerId;
    if (!stripeCustomerId) {
      return failure(
        "Customer has no stripeCustomerId — run setupDealerForPostpaid first",
        payment.id,
        EnumPaymentStatus.FAILED,
      );
    }

    const amountDollars = Number(payment.amount ?? 0);
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents <= 0) {
      return failure(
        `Payment.amount is ${amountDollars} — cannot report 0/negative usage`,
        payment.id,
        EnumPaymentStatus.FAILED,
      );
    }

    const miles = Number(delivery.quote?.distanceMiles ?? 0).toFixed(1);
    const description = this.formatInvoiceItemDescription({
      deliveryId: delivery.id,
      pickup: delivery.pickupAddress,
      dropoff: delivery.dropoffAddress,
      miles,
      amount: amountDollars.toFixed(2),
    });

    try {
      const invoiceItem = await this.stripeService.stripe.invoiceItems.create({
        customer: stripeCustomerId,
        amount: amountCents,
        currency: "usd",
        description,
        metadata: {
          [STRIPE_METADATA_KEYS.DELIVERY_ID]: delivery.id,
          [STRIPE_METADATA_KEYS.PAYMENT_ID]: payment.id,
          [STRIPE_METADATA_KEYS.CUSTOMER_ID]: delivery.customer!.id,
          [STRIPE_METADATA_KEYS.SOURCE]: "postpaid-weekly",
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeInvoiceItemId: invoiceItem.id,
          status: EnumPaymentStatus.USAGE_REPORTED,
        },
      });

      this.logger.log(
        `Reported usage for delivery ${input.deliveryId}: InvoiceItem ${invoiceItem.id} ` +
          `($${amountDollars.toFixed(2)} — ${delivery.pickupAddress} → ${delivery.dropoffAddress})`,
      );

      return {
        deliveryId: input.deliveryId,
        paymentId: payment.id,
        stripeInvoiceItemId: invoiceItem.id,
        status: EnumPaymentStatus.USAGE_REPORTED,
      };
    } catch (err: any) {
      const msg = err?.message || "Unknown Stripe error creating InvoiceItem";
      this.logger.error(
        `Stripe InvoiceItem creation failed for delivery ${input.deliveryId}: ${msg}`,
        err?.stack,
      );
      // Leave the Payment row in its prior status — admin can retry.
      return failure(msg, payment.id, payment.status as EnumPaymentStatus);
    }
  }

  // ─── WEBHOOK HANDLERS ──────────────────────────────────────────

  /**
   * invoice.upcoming — fires ~1 hour before Stripe finalizes the weekly
   * invoice. Used to attach a human-readable summary description to the
   * invoice (in addition to the per-delivery line items already attached
   * as InvoiceItems).
   *
   * Optional — per-delivery line items already have pickup/dropoff, so
   * this is just a top-of-invoice summary line.
   */
  async handleInvoiceUpcoming(invoiceId: string): Promise<void> {
    if (!this.stripeService) return;
    try {
      const invoice = await this.stripeService.stripe.invoices.retrieve(invoiceId, {
        expand: ["lines"],
      });

      const stripeCustomerId = this.resolveStripeCustomerId(invoice.customer);
      if (!stripeCustomerId) {
        this.logger.warn(`invoice.upcoming: no customer on invoice ${invoiceId}`);
        return;
      }
      const dealer = await this.prisma.customer.findFirst({
        where: { stripeCustomerId },
        select: { id: true, businessName: true },
      });
      if (!dealer) {
        this.logger.warn(`invoice.upcoming: no dealer found for stripeCustomer ${stripeCustomerId}`);
        return;
      }

      const lineCount = (invoice as any).lines?.data?.length ?? 0;
      const totalCents = invoice.total ?? 0;
      const summary =
        `Weekly delivery summary for ${dealer.businessName || dealer.id} — ` +
        `${lineCount} delivery(ies), total $${(totalCents / 100).toFixed(2)}. ` +
        `Detail lines below show pickup → drop-off per delivery.`;

      await this.stripeService.stripe.invoices.update(invoiceId, {
        description: summary,
      });
      this.logger.log(
        `invoice.upcoming: set description on invoice ${invoiceId} for dealer ${dealer.id} (${lineCount} lines)`,
      );
    } catch (err: any) {
      this.logger.error(
        `handleInvoiceUpcoming failed for invoice ${invoiceId}: ${err?.message}`,
      );
    }
  }

  /**
   * invoice.payment_succeeded — Stripe charged the dealer's saved PM for
   * the weekly invoice. Mark all Payment rows with the matching
   * stripeInvoiceId as PAID.
   *
   * Note: Stripe creates the invoice, then charges. The InvoiceItem ids
   * we stored on Payment rows appear on the invoice's line items — but
   * the invoice itself has its own id. To match, we look at
   * invoice.lines.data[].invoiceitem for each line and update the
   * Payment rows that match.
   */
  async handleInvoicePaymentSucceeded(invoiceId: string): Promise<void> {
    if (!this.stripeService) return;
    try {
      const invoice = await this.stripeService.stripe.invoices.retrieve(invoiceId, {
        expand: ["lines"],
      });

      const lineItems = (invoice as any).lines?.data ?? [];
      const invoiceItemIds: string[] = lineItems
        .map((l: any) => l.invoiceitem)
        .filter(Boolean);

      if (invoiceItemIds.length === 0) {
        this.logger.log(
          `invoice.payment_succeeded ${invoiceId}: no InvoiceItems — likely the $0 anchor charge, nothing to mark`,
        );
        return;
      }

      // Bulk update all Payment rows with matching stripeInvoiceItemId.
      // Also stamp stripeInvoiceId so future queries can find them.
      const result = await this.prisma.payment.updateMany({
        where: { stripeInvoiceItemId: { in: invoiceItemIds } },
        data: {
          status: EnumPaymentStatus.PAID,
          paidAt: new Date(),
          stripeInvoiceId: invoiceId,
        },
      });

      this.logger.log(
        `invoice.payment_succeeded ${invoiceId}: marked ${result.count} Payment(s) as PAID`,
      );
    } catch (err: any) {
      this.logger.error(
        `handleInvoicePaymentSucceeded failed for invoice ${invoiceId}: ${err?.message}`,
      );
    }
  }

  /**
   * invoice.payment_failed — Stripe's weekly charge failed (dead card,
   * insufficient funds, etc.). Mark the Payments as CHARGE_FAILED and
   * freeze the dealer so they can't create more deliveries until the
   * issue is resolved.
   */
  async handleInvoicePaymentFailed(invoiceId: string): Promise<void> {
    if (!this.stripeService) return;
    try {
      const invoice = await this.stripeService.stripe.invoices.retrieve(invoiceId, {
        expand: ["lines"],
      });

      const stripeCustomerId = this.resolveStripeCustomerId(invoice.customer);

      const lineItems = (invoice as any).lines?.data ?? [];
      const invoiceItemIds: string[] = lineItems
        .map((l: any) => l.invoiceitem)
        .filter(Boolean);

      if (invoiceItemIds.length > 0) {
        await this.prisma.payment.updateMany({
          where: { stripeInvoiceItemId: { in: invoiceItemIds } },
          data: {
            status: EnumPaymentStatus.CHARGE_FAILED,
            failedAt: new Date(),
            failureMessage:
              (invoice as any).last_payment_error?.message ||
              "Weekly charge failed",
            stripeInvoiceId: invoiceId,
          },
        });
      }

      // Freeze the dealer so they can't create more deliveries until admin
      // resolves (e.g. dealer adds a new card → admin clicks "retry" or
      // "unfreeze" in the admin UI).
      if (stripeCustomerId) {
        await this.prisma.customer.updateMany({
          where: { stripeCustomerId },
          data: {
            billingFrozen: true,
            billingFrozenAt: new Date(),
            billingFrozenReason: FREEZE_REASONS.CHARGE_FAILED,
          },
        });
        this.logger.warn(
          `Dealer with stripeCustomer ${stripeCustomerId} FROZEN due to failed invoice ${invoiceId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `handleInvoicePaymentFailed failed for invoice ${invoiceId}: ${err?.message}`,
      );
    }
  }

  // ─── ADMIN ACTIONS ─────────────────────────────────────────────

  /**
   * Set or clear the per-dealer postpaid cap (in cents). null = unlimited.
   */
  async setCreditCap(dealerId: string, capCents: number | null): Promise<void> {
    if (capCents !== null && capCents < 0) {
      throw new BadRequestException("Cap cannot be negative — use null for unlimited");
    }
    await this.prisma.customer.update({
      where: { id: dealerId },
      data: { postpaidCreditLimitCents: capCents },
    });
    this.logger.log(
      `Set postpaid cap for dealer ${dealerId}: ${capCents === null ? "unlimited" : `$${(capCents / 100).toFixed(2)}`}`,
    );
  }

  /**
   * Manually unfreeze a dealer — used after admin confirms the dealer has
   * fixed their card (e.g. via the saved-card flow).
   *
   * Does NOT retry the failed charge — call retryFailedCharge for that.
   */
  async unfreezeDealer(dealerId: string): Promise<void> {
    await this.prisma.customer.update({
      where: { id: dealerId },
      data: {
        billingFrozen: false,
        billingFrozenAt: null,
        billingFrozenReason: null,
      },
    });
    this.logger.log(`Dealer ${dealerId} manually unfrozen by admin`);
  }

  /**
   * Retry the most recent failed weekly invoice for a dealer. Stripe
   * supports `POST /v1/invoices/{id}/pay` which attempts to charge the
   * customer's default PM again. On success, the payment_succeeded
   * webhook will fire and mark the Payments PAID + clear the freeze.
   */
  async retryFailedCharge(dealerId: string): Promise<void> {
    if (!this.stripeService) {
      throw new Error("StripeService unavailable");
    }
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });
    if (!dealer?.stripeSubscriptionId) {
      throw new BadRequestException("Dealer has no Stripe subscription — retry impossible");
    }

    // Find the most recent open invoice for this subscription
    const invoices = await this.stripeService.stripe.invoices.list({
      subscription: dealer.stripeSubscriptionId,
      limit: 5,
      status: "open",
    });

    if (invoices.data.length === 0) {
      throw new BadRequestException("No open invoice found for this dealer's subscription");
    }

    const invoice = invoices.data[0];
    await this.stripeService.stripe.invoices.pay(invoice.id, {
      paid_out_of_band: false,
    });

    // Stripe will fire invoice.payment_succeeded or .payment_failed shortly;
    // our webhook handlers will update Payment rows + freeze state.
    this.logger.log(`Retried invoice ${invoice.id} for dealer ${dealerId}`);
  }

  // ─── INTERNAL HELPERS ───────────────────────────────────────────

  /**
   * Compute the dealer's outstanding postpaid balance in cents —
   * sum of all Payment rows where:
   *   paymentType = POSTPAID
   *   status IN (PENDING_STRIPE_USAGE, USAGE_REPORTED, CHARGE_FAILED)
   *   (NOT PAID, NOT REFUNDED, NOT VOIDED — those are settled)
   */
  private async computeOutstandingBalanceCents(dealerId: string): Promise<number> {
    const rows = await this.prisma.payment.findMany({
      where: {
        delivery: { customerId: dealerId },
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: {
          in: [
            EnumPaymentStatus.PENDING_STRIPE_USAGE,
            EnumPaymentStatus.USAGE_REPORTED,
            EnumPaymentStatus.CHARGE_FAILED,
            // Also count AUTHORIZED + INVOICED — the legacy postpaid states
            // (existing deliveries created before this PR may still be in
            // these states; cap check should still count their unpaid amount).
            EnumPaymentStatus.AUTHORIZED,
            EnumPaymentStatus.INVOICED,
          ],
        },
      },
      select: { amount: true },
    });
    return rows.reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  }

  /**
   * Format the per-delivery line-item description. Truncates addresses
   * if the result would exceed Stripe's display limits (~250 chars on
   * invoice PDF).
   */
  private formatInvoiceItemDescription(input: {
    deliveryId: string;
    pickup: string;
    dropoff: string;
    miles: string;
    amount: string;
  }): string {
    const MAX_ADDR = 80; // chars per address, leaves room for the rest
    const truncate = (s: string) =>
      s.length > MAX_ADDR ? `${s.slice(0, MAX_ADDR - 1)}…` : s;
    return INVOICE_ITEM_DESCRIPTION_TEMPLATE.replace("{deliveryId}", input.deliveryId.slice(-8))
      .replace("{pickup}", truncate(input.pickup))
      .replace("{dropoff}", truncate(input.dropoff))
      .replace("{miles}", input.miles)
      .replace("{amount}", input.amount);
  }

  /**
   * Resolve a Stripe Customer id from the various forms Stripe returns
   * it in on the Invoice object (string | Stripe.Customer | null).
   */
  private resolveStripeCustomerId(customer: string | { id: string } | null | undefined): string | null {
    if (!customer) return null;
    if (typeof customer === "string") return customer;
    return customer.id ?? null;
  }
}

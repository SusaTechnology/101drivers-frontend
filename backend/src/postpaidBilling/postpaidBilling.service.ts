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
//   • Pricing — reads Payment.amount (calculated by PricingEngineService at
//     quote time using either PER_MILE or CATEGORY_ABC mode).
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
    //
    //    collection_method="charge_automatically" → Stripe charges the saved
    //    payment method automatically when each weekly invoice is created.
    //
    //    NOTE: `days_until_due` is ONLY valid when collection_method=
    //    "send_invoice". With "charge_automatically" Stripe rejects it with
    //    HTTP 400: "You can only specify 'days_until_due' if invoice
    //    collection method is 'send_invoice'." So we omit it — Stripe will
    //    attempt payment 1 hour after the invoice is created (default).
    //
    //    billing_cycle_anchor is intentionally omitted so Stripe picks the
    //    anchor (creation time + 7d cycles). A future admin can migrate
    //    dealers to a Sunday 02:00 dealer-TZ anchor if needed.
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

    // 3b. Clear stale NO_STRIPE_CUSTOMER failures now that the dealer has
    //     a Stripe customer. These old Payment rows were CHARGE_FAILED
    //     only because the dealer didn't have a Stripe customer at the
    //     time of the charge. The charge can't be retroactively billed
    //     (no invoice exists), but we clear the failureCode +
    //     failureMessage so:
    //       (a) getSwitchEligibility's "has failed charges" check
    //           doesn't see them (the issue is resolved)
    //       (b) the admin payments page doesn't show a scary "NO_STRIPE_CUSTOMER"
    //           error for a dealer that now has a Stripe customer
    //     The Payment status stays CHARGE_FAILED (the money was never
    //     collected) — we just clear the failureCode so it's not used as
    //     a "current failure" indicator.
    try {
      const cleared = await this.prisma.payment.updateMany({
        where: {
          delivery: { customerId: dealerId },
          status: 'CHARGE_FAILED',
          failureCode: 'NO_STRIPE_CUSTOMER',
        },
        data: {
          failureCode: null,
          failureMessage: null,
        },
      });
      if (cleared.count > 0) {
        this.logger.log(
          `Setup: cleared ${cleared.count} stale NO_STRIPE_CUSTOMER failure(s) for dealer ${dealerId}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Setup: failed to clear stale NO_STRIPE_CUSTOMER failures for dealer ${dealerId}: ${err.message}`,
      );
    }

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
   *   • amount = Payment.amount × 100 (calculated by the pricing engine at
   *     delivery-creation time using either PER_MILE or CATEGORY_ABC mode)
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
   *
   * Idempotency: Stripe retries webhooks. This handler is idempotent —
   * re-marking an already-PAID Payment as PAID is a no-op. We also
   * short-circuit the $0 anchor invoice (subscription_cycle with no
   * InvoiceItems) silently to avoid log noise on every retry.
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
        // $0 anchor subscription cycle — no per-delivery line items.
        // Don't log on every retry; just short-circuit.
        const billingReason = (invoice as any).billing_reason;
        if (billingReason === "subscription_cycle") {
          // Anchor invoice — expected, no action needed.
          return;
        }
        this.logger.log(
          `invoice.payment_succeeded ${invoiceId}: no InvoiceItems (billing_reason=${billingReason}) — nothing to mark`,
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
   *
   * Idempotency: Stripe retries webhooks. The Payment updateMany is
   * idempotent (re-marking CHARGE_FAILED is a no-op). For the freeze,
   * we skip the re-write if the dealer is already frozen with the same
   * reason — avoids bumping billingFrozenAt on every retry and keeps
   * logs clean.
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

      const failureMessage =
        (invoice as any).last_payment_error?.message ||
        "Weekly charge failed";
      const failureCode =
        (invoice as any).last_payment_error?.code ||
        (invoice as any).last_payment_error?.decline_code ||
        null;

      // Also capture the next retry date from Stripe (if scheduled)
      const nextRetryAttempt = (invoice as any).next_payment_attempt || null;

      // Stripe's attempt_count — which retry attempt this is (1 = initial,
      // 2 = first retry, etc.). Stored on the Payment row so the admin
      // can see "Failure attempt: 2 of 4" without querying Stripe.
      const attemptCount = (invoice as any).attempt_count || 1;

      if (invoiceItemIds.length > 0) {
        // ── Primary path: match by stripeInvoiceItemId ──
        await this.prisma.payment.updateMany({
          where: { stripeInvoiceItemId: { in: invoiceItemIds } },
          data: {
            status: EnumPaymentStatus.CHARGE_FAILED,
            failedAt: new Date(),
            failureCode,
            failureMessage,
            stripeInvoiceId: invoiceId,
            attemptCount,
          },
        });
      } else {
        // ── Fallback: match by stripeInvoiceId ──
        // If Stripe returned line items without the `invoiceitem` field
        // (happens for some invoice types), fall back to marking ALL
        // Payments with this stripeInvoiceId as CHARGE_FAILED.
        // This ensures the admin always sees the failure even if the
        // line-item matching fails.
        await this.prisma.payment.updateMany({
          where: { stripeInvoiceId: invoiceId },
          data: {
            status: EnumPaymentStatus.CHARGE_FAILED,
            failedAt: new Date(),
            failureCode,
            failureMessage,
            attemptCount,
          },
        });
        this.logger.warn(
          `handleInvoicePaymentFailed: line-item IDs not found — fell back to stripeInvoiceId match for ${invoiceId}`,
        );
      }

      // ── Graduated freeze logic ──────────────────────────────────
      // Big companies (Uber, DoorDash, Amazon) don't freeze accounts
      // on the first payment failure. Stripe auto-retries up to 4 times
      // over ~2 weeks. We follow the same pattern:
      //
      //   1st failure:  NO freeze. Stripe will auto-retry. Dealer sees
      //                 an amber banner: "Update your card before [date]."
      //   2nd failure:  NO freeze. Red banner. Dealer sees: "Payment
      //                 failed again. Please update your card."
      //   3rd+ failure: RESTRICT (not full freeze). Dealer can't create
      //                 NEW deliveries but can still access dashboard,
      //                 see history, update payment, contact support.
      //   Fraudulent:   IMMEDIATE freeze. Admin review required.
      //   Transient:    NO freeze, no banner. Just retry.
      //
      // attemptCount was already extracted from the invoice above (line ~650).
      // Stripe increments `attempt_count` on each retry.
      const MAX_FAILURES_BEFORE_RESTRICT = 3;

      // Fraud/security violations → immediate freeze regardless of count
      const isCritical =
        failureCode === 'fraudulent' ||
        failureCode === 'security_violation' ||
        failureCode === 'service_not_allowed';

      // Transient errors → never freeze, never restrict
      const isTransient =
        failureCode === 'processing_error' ||
        failureCode === 'offline_decline' ||
        failureCode === 'issuer_unavailable';

      const shouldRestrict = isCritical || (!isTransient && attemptCount >= MAX_FAILURES_BEFORE_RESTRICT);

      if (stripeCustomerId && shouldRestrict) {
        const existing = await this.prisma.customer.findFirst({
          where: { stripeCustomerId },
          select: { id: true, billingFrozen: true, billingFrozenReason: true },
        });
        const alreadyFrozenWithSameReason =
          existing?.billingFrozen === true &&
          existing.billingFrozenReason === FREEZE_REASONS.CHARGE_FAILED;

        if (existing && !alreadyFrozenWithSameReason) {
          await this.prisma.customer.update({
            where: { id: existing.id },
            data: {
              billingFrozen: true,
              billingFrozenAt: new Date(),
              billingFrozenReason: FREEZE_REASONS.CHARGE_FAILED,
            },
          });
          this.logger.warn(
            `Dealer ${existing.id} RESTRICTED after ${attemptCount} payment failure(s) on invoice ${invoiceId} (code: ${failureCode})`,
          );
        } else if (alreadyFrozenWithSameReason) {
          // Already restricted — skip silently
        } else {
          this.logger.warn(
            `invoice.payment_failed ${invoiceId}: no Customer row found for stripeCustomer ${stripeCustomerId} — cannot restrict`,
          );
        }
      } else if (stripeCustomerId && !shouldRestrict) {
        // First or second failure — log but DON'T freeze
        this.logger.log(
          `Payment failure #${attemptCount} for invoice ${invoiceId} (code: ${failureCode}). ` +
          `Stripe will auto-retry. Dealer NOT frozen — graduated response. ` +
          `Will restrict after ${MAX_FAILURES_BEFORE_RESTRICT} failures.`,
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
   * Pre-check: can the admin switch this dealer's billing mode?
   *
   * Returns:
   *   - canSwitch: boolean (false if blocked)
   *   - blockReason: string | null (why it's blocked)
   *   - outstandingBalance: number (sum of USAGE_REPORTED + AUTHORIZED postpaid payments)
   *   - pendingDeliveryCount: number (USAGE_REPORTED payments awaiting invoice)
   *   - failedChargeCount: number (CHARGE_FAILED + FAILED payments — unresolved)
   *   - hasSavedPaymentMethod: boolean
   *   - currentMode: 'PREPAID' | 'POSTPAID'
   *
   * The admin UI calls this before showing the switch dialog so the
   * admin sees the full impact BEFORE committing to the switch.
   */
  async getSwitchEligibility(dealerId: string): Promise<{
    canSwitch: boolean;
    blockReason: string | null;
    outstandingBalance: number;
    pendingDeliveryCount: number;
    failedChargeCount: number;
    hasSavedPaymentMethod: boolean;
    currentMode: 'PREPAID' | 'POSTPAID';
    stripeSubscriptionId: string | null;
  }> {
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        postpaidEnabled: true,
        billingMode: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
        stripeSubscriptionId: true,
        billingFrozen: true,
      },
    });

    if (!dealer) {
      throw new NotFoundException('Dealer not found');
    }

    const currentMode = dealer.postpaidEnabled ? 'POSTPAID' : 'PREPAID';

    // ── Build the failed-charge where clause ───────────────────────────
    //
    // We count payments with status CHARGE_FAILED or FAILED, BUT we
    // filter out STALE / UNFIXABLE failures — failures that either:
    //
    //   (a) Have been resolved since the failure happened:
    //       • NO_SAVED_CARD → the dealer NOW has a stripeDefaultPaymentMethodId
    //         (e.g., they added a card via the saved-card flow after the
    //         failure). The Retry Charge button WILL work for these —
    //         there's a Stripe invoice and now a card to charge.
    //
    //   (b) Are structurally unfixable and don't represent a money-loss
    //       risk for switching:
    //       • NO_STRIPE_CUSTOMER → the dealer had no Stripe customer at
    //         the time of the charge, so the charge never reached Stripe.
    //         There's no invoice to retry — the failure is permanent.
    //         Switching billing modes doesn't lose money (no money was
    //         ever going to be collected via Stripe for this delivery).
    //         The fix is for the admin to set the dealer up (which the
    //         switch to postpaid triggers), so the failure shouldn't
    //         block the switch.
    //
    // Past failures that have since SUCCEEDED are already excluded
    // because their status was updated to PAID by the
    // handleInvoicePaymentSucceeded webhook (Stripe fires this when a
    // retried invoice charge succeeds — see handleInvoicePaymentSucceeded).
    //
    // Prisma's NOT clause is a list of conditions that, if ANY matches,
    // exclude the row. We always exclude NO_STRIPE_CUSTOMER, and
    // conditionally exclude NO_SAVED_CARD only when the dealer now has
    // a saved PM (otherwise the failure is still actionable via Retry).
    //
    // Prepaid-only failures (STRIPE_API_ERROR, STRIPE_NOT_CONFIGURED,
    // STRIPE_LIST_PM_ERROR) are ALSO always excluded because the
    // "Retry Charge" button retries POSTPAID Stripe invoices via
    // stripe.invoices.pay — it cannot retry prepaid PaymentIntents.
    // Blocking the switch doesn't help collect the money owed for
    // these failures; the dealer would need to re-submit the delivery
    // after fixing the underlying issue (or admin marks it
    // uncollectible). Letting the switch proceed lets the dealer move
    // to postpaid (where future charges will go through Stripe
    // invoices that CAN be retried).
    //
    // PI_STATUS_* failures (3DS required, card declined at PI level)
    // are also prepaid-only — we exclude them with a startsWith filter
    // below (NOT doesn't support startsWith, so we use a separate
    // filter on the result set).
    const staleFailureCodesToExclude: string[] = [
      // Structurally unfixable — no Stripe invoice exists to retry
      'NO_STRIPE_CUSTOMER',
      // Prepaid-only API failures — Retry Charge can't help
      'STRIPE_API_ERROR',
      'STRIPE_NOT_CONFIGURED',
      'STRIPE_LIST_PM_ERROR',
    ];
    if (dealer.stripeDefaultPaymentMethodId) {
      // Dealer now has a saved card → old NO_SAVED_CARD failures are stale
      // (the Retry Charge button will work — there's an invoice + a card).
      staleFailureCodesToExclude.push('NO_SAVED_CARD');
    }

    const failedChargeWhere: any = {
      delivery: { customerId: dealerId },
      status: { in: ['CHARGE_FAILED', 'FAILED'] },
      NOT: [
        ...staleFailureCodesToExclude.map((code) => ({ failureCode: code })),
        // PI_STATUS_* failures (prepaid-only, 3DS / card-action required)
        // — Retry Charge can't help. Use a regex-like match via startsWith.
        { failureCode: { startsWith: 'PI_STATUS_' } },
      ],
    };

    const failedChargeCount = await this.prisma.payment.count({
      where: failedChargeWhere,
    });

    // Count pending postpaid deliveries (USAGE_REPORTED — awaiting weekly invoice)
    const pendingDeliveryCount = await this.prisma.payment.count({
      where: {
        delivery: { customerId: dealerId },
        paymentType: 'POSTPAID',
        status: 'USAGE_REPORTED',
      },
    });

    // Outstanding balance = sum of unpaid postpaid payments
    const outstandingCents = await this.computeOutstandingBalanceCents(dealerId);
    const outstandingBalance = Number((outstandingCents / 100).toFixed(2));

    const hasSavedPaymentMethod = Boolean(dealer.stripeDefaultPaymentMethodId);

    // Determine if switch is blocked
    let canSwitch = true;
    let blockReason: string | null = null;

    // Block if there are unresolved failed charges
    if (failedChargeCount > 0) {
      canSwitch = false;

      // Get the most recent failed payment details for context
      // (uses the same filtered where clause as the count above)
      const recentFailed = await this.prisma.payment.findFirst({
        where: failedChargeWhere,
        select: {
          amount: true,
          failureCode: true,
          failureMessage: true,
          failedAt: true,
          stripeInvoiceId: true,
        },
        orderBy: { failedAt: 'desc' },
      });

      const failureCode = recentFailed?.failureCode || '';
      const failedAmount = recentFailed ? `$${recentFailed.amount.toFixed(2)}` : '';
      const failureReason = this.describeFailure(failureCode);

      // Build error-type-specific next steps.
      //
      // isMissingResource: the failure was caused by the dealer missing a
      // Stripe resource (no customer, no saved card). The fix is to
      // set the dealer up — NOT to retry a charge (there's nothing to
      // retry). The Retry Charge button is disabled in this case.
      const isMissingResource =
        failureCode === 'NO_STRIPE_CUSTOMER' ||
        failureCode === 'NO_SAVED_CARD' ||
        failureCode === 'no_card';

      // isCardIssue: the failure was caused by a card problem (decline,
      // expired, etc.). Retry Charge makes sense here — there's a Stripe
      // invoice to retry.
      const isCardIssue =
        failureCode === 'card_declined' ||
        failureCode === 'expired_card' ||
        failureCode === 'incorrect_cvc' ||
        failureCode === 'incorrect_number' ||
        failureCode === 'insufficient_funds' ||
        failureCode === 'lost_card' ||
        failureCode === 'stolen_card';

      const isTransient =
        failureCode === 'processing_error' ||
        failureCode === 'issuer_unavailable' ||
        failureCode === 'offline_decline';

      const isFraud =
        failureCode === 'fraudulent' ||
        failureCode === 'security_violation';

      let nextSteps = '';

      if (isFraud) {
        nextSteps =
          `Next steps (admin action required):\n` +
          `• ⚠️ This charge was flagged by Stripe as potentially fraudulent.\n` +
          `• Review the dealer's account and the payment details in the Stripe dashboard.\n` +
          `• Do NOT retry the charge until you've verified the dealer.\n` +
          `• Contact support if you need help investigating.`;
      } else if (isMissingResource) {
        // NO_STRIPE_CUSTOMER / NO_SAVED_CARD / no_card — the Retry Charge
        // button is disabled because there's no Stripe invoice to retry.
        // The fix is to set the dealer up (or have them add a card).
        const isNoCustomer = failureCode === 'NO_STRIPE_CUSTOMER';
        nextSteps =
          `Next steps:\n` +
          `• This failure happened because the dealer had ${isNoCustomer ? 'no Stripe customer on file' : 'no saved payment method'} at the time of the charge.\n` +
          `• The "Retry Charge" button is disabled because there's no Stripe invoice to retry — the charge never reached Stripe.\n` +
          (isNoCustomer
            ? `• Admin: Click "Setup Postpaid" in the Postpaid Billing section below to create the Stripe customer + subscription.\n`
            : `• Dealer: Ask the dealer to add a card via Settings → Payment Methods.\n`) +
          `• Once setup is complete, this old failure won't block billing-mode switches anymore.`;
      } else if (isTransient) {
        nextSteps =
          `Next steps (no action needed):\n` +
          `• This was a temporary processing error — not a card problem.\n` +
          `• Stripe will automatically retry the charge (typically within 2 days).\n` +
          `• No action is needed from you or the dealer.\n` +
          `• Once the retry succeeds, the block will clear and you can switch.`;
      } else if (isCardIssue) {
        nextSteps =
          `Next steps:\n` +
          `• Admin: Use the "Retry Charge" button in the Postpaid Billing section below to retry now (if the dealer has already updated their card).\n` +
          `• Dealer: Ask the dealer to update their card in Settings → Payment Methods.\n` +
          `• Stripe will also automatically retry (typically within 2 days).\n` +
          `• Once the charge succeeds (auto-retry or manual retry), the block will clear and you can switch.`;
      } else {
        // Unknown error — give general guidance
        nextSteps =
          `Next steps:\n` +
          `• Stripe will automatically retry the charge (typically within 2 days).\n` +
          `• Admin: Use the "Retry Charge" button in the Postpaid Billing section below to retry now.\n` +
          `• Dealer: Ask the dealer to check their payment method in Settings → Payment Methods.\n` +
          `• Once the charge succeeds, the block will clear and you can switch.`;
      }

      blockReason =
        `Cannot switch billing modes — this dealer has ${failedChargeCount} ` +
        `failed charge(s).\n\n` +
        `Latest failure: ${failedAmount} — ${failureReason}.\n\n` +
        nextSteps;
    }

    // Block switching TO postpaid if no saved card
    if (canSwitch && currentMode === 'PREPAID' && !hasSavedPaymentMethod) {
      canSwitch = false;
      blockReason =
        'Cannot switch to Postpaid — no saved payment method on file. ' +
        'The dealer must add a card first (Settings → Payment Methods), ' +
        'then retry the switch.';
    }

    return {
      canSwitch,
      blockReason,
      outstandingBalance,
      pendingDeliveryCount,
      failedChargeCount,
      hasSavedPaymentMethod,
      currentMode,
      stripeSubscriptionId: dealer.stripeSubscriptionId,
    };
  }

  /**
   * Safely switch a dealer's billing mode.
   *
   * Postpaid → Prepaid:
   *   - Sets postpaidEnabled = false (new deliveries are prepaid immediately)
   *   - Cancels the Stripe subscription with cancel_at_period_end = true
   *     (current billing cycle finishes — pending InvoiceItems are still charged)
   *   - Sets billingMode = PREPAID_INSTANT
   *   - Does NOT clear stripeCustomerId / stripeDefaultPaymentMethodId
   *     (still needed for prepaid charges)
   *   - Clears stale NO_STRIPE_CUSTOMER / NO_SAVED_CARD failure codes
   *     on old Payment rows (the underlying issue is resolved by the switch)
   *
   * Prepaid → Postpaid:
   *   - Sets postpaidEnabled = true + billingMode = WEEKLY_POSTPAID
   *   - If an existing Stripe subscription is found (previously cancelled at
   *     period end when the dealer was switched to prepaid), it is REACTIVATED
   *     by setting cancel_at_period_end = false. The Stripe customer +
   *     subscription IDs are preserved.
   *   - If NO existing Stripe subscription is found, the admin must click
   *     the "Setup Postpaid" button in the admin UI to create one. The
   *     switch itself just flips the flag — it does NOT auto-create the
   *     Stripe customer/subscription. (This gives the admin explicit control
   *     and matches the UI flow where the Postpaid Billing section is
   *     highlighted after the switch to remind the admin to complete setup.)
   *
   * Returns a structured result so the frontend can show the right message
   * (existing subscription reactivated vs. setup still required).
   */
  async switchBillingMode(
    dealerId: string,
    newMode: 'PREPAID' | 'POSTPAID',
  ): Promise<{
    mode: 'PREPAID' | 'POSTPAID';
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionReactivated: boolean;
    setupRequired: boolean;
  }> {
    // Pre-check
    const eligibility = await this.getSwitchEligibility(dealerId);
    if (!eligibility.canSwitch) {
      throw new BadRequestException(eligibility.blockReason || 'Cannot switch billing modes');
    }

    if (newMode === eligibility.currentMode) {
      throw new BadRequestException(`Dealer is already on ${newMode} billing`);
    }

    if (newMode === 'PREPAID') {
      // ── Postpaid → Prepaid ──────────────────────────────────
      // Cancel the subscription at period end so pending InvoiceItems
      // are still charged in the current cycle. New deliveries from
      // this point are prepaid (charged immediately at creation).
      if (eligibility.stripeSubscriptionId && this.stripeService) {
        try {
          await this.stripeService.stripe.subscriptions.update(
            eligibility.stripeSubscriptionId,
            { cancel_at_period_end: true },
          );
          this.logger.log(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `set to cancel at period end (switching to prepaid)`,
          );
        } catch (err: any) {
          this.logger.warn(
            `Failed to cancel subscription for dealer ${dealerId}: ${err.message} ` +
            `— proceeding with flag update anyway. Admin should cancel manually in Stripe.`,
          );
        }
      }

      await this.prisma.customer.update({
        where: { id: dealerId },
        data: {
          postpaidEnabled: false,
          billingMode: 'PREPAID_INSTANT',
        },
      });

      // Clear stale failure data — the customer now has a Stripe customer
      // + payment method, so old NO_STRIPE_CUSTOMER / NO_SAVED_CARD errors
      // are no longer relevant.
      await this.prisma.payment.updateMany({
        where: {
          delivery: { customerId: dealerId },
          failureCode: { in: ['NO_STRIPE_CUSTOMER', 'NO_SAVED_CARD'] },
        },
        data: {
          failureCode: null,
          failureMessage: null,
        },
      });

      this.logger.log(`Dealer ${dealerId} switched to PREPAID`);

      // Fetch the updated customer to return current Stripe refs
      const updated = await this.prisma.customer.findUnique({
        where: { id: dealerId },
        select: { stripeCustomerId: true, stripeSubscriptionId: true },
      });
      return {
        mode: 'PREPAID',
        stripeCustomerId: updated?.stripeCustomerId ?? null,
        stripeSubscriptionId: updated?.stripeSubscriptionId ?? null,
        subscriptionReactivated: false,
        setupRequired: false,
      };
    }

    // ── Prepaid → Postpaid ───────────────────────────────────
    // 1. Flip the customer flags first. setupDealerForPostpaid (called
    //    separately by the admin via the "Setup Postpaid" button) requires
    //    postpaidEnabled=true, so we set it here before any Stripe work.
    await this.prisma.customer.update({
      where: { id: dealerId },
      data: {
        postpaidEnabled: true,
        billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
      },
    });

    let subscriptionReactivated = false;

    // 2. If an existing subscription is present, REACTIVATE it. When the
    //    dealer was previously switched to prepaid, we set
    //    cancel_at_period_end=true on the subscription. As long as the
    //    current billing period hasn't ended, the subscription is still
    //    "active" and can be un-cancelled by setting cancel_at_period_end
    //    back to false. If the period already ended and the subscription
    //    is fully canceled, the admin will need to click "Setup Postpaid"
    //    to create a new one.
    if (eligibility.stripeSubscriptionId && this.stripeService) {
      try {
        const sub = await this.stripeService.stripe.subscriptions.retrieve(
          eligibility.stripeSubscriptionId,
        );

        if (sub.status === 'active' && sub.cancel_at_period_end) {
          await this.stripeService.stripe.subscriptions.update(
            eligibility.stripeSubscriptionId,
            { cancel_at_period_end: false },
          );
          subscriptionReactivated = true;
          this.logger.log(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `re-activated (cancel_at_period_end=false) on switch to postpaid`,
          );
        } else if (sub.status === 'active') {
          // Already active and not marked for cancellation — nothing to do
          subscriptionReactivated = true;
          this.logger.log(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `already active — no reactivation needed`,
          );
        } else {
          // Subscription is canceled/expired/unpaid — admin needs to set up a new one
          this.logger.warn(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `is in status ${sub.status} — admin must click "Setup Postpaid" to create a new one`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to retrieve/re-activate subscription ${eligibility.stripeSubscriptionId} ` +
          `for dealer ${dealerId}: ${err.message} — admin may need to click "Setup Postpaid" manually.`,
        );
      }
    }

    // Fetch the updated customer to return current Stripe refs
    const updated = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: { stripeCustomerId: true, stripeSubscriptionId: true },
    });

    this.logger.log(
      `Dealer ${dealerId} switched to POSTPAID ` +
      `(reactivated=${subscriptionReactivated}, setupRequired=${!subscriptionReactivated && !updated?.stripeSubscriptionId})`,
    );

    return {
      mode: 'POSTPAID',
      stripeCustomerId: updated?.stripeCustomerId ?? null,
      stripeSubscriptionId: updated?.stripeSubscriptionId ?? null,
      subscriptionReactivated,
      setupRequired: !subscriptionReactivated,
    };
  }
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

  // ─── DEALER-SCOPED STATUS ──────────────────────────────────────

  /**
   * Returns the dealer's own postpaid billing status. Used by the
   * dealer-facing "Weekly Postpaid" panel — outstanding balance,
   * frozen state + reason, cap usage, and Stripe IDs (for debugging).
   *
   * Caller (PostpaidBillingController.getMyStatus) is responsible for
   * authenticating the request and resolving the dealerId from the
   * JWT — we never trust a dealerId passed in the body.
   *
   * Returns the same shape as the admin getStatus endpoint, but
   * WITHOUT the unpaidPayments array (dealers don't need line-by-line
   * detail; they get that from their Stripe invoice PDF).
   */
  async getMyStatus(dealerId: string): Promise<{
    dealerId: string;
    businessName: string | null;
    postpaidEnabled: boolean;
    billingMode: string | null;
    billingFrozen: boolean;
    billingFrozenAt: Date | null;
    billingFrozenReason: string | null;
    capCents: number | null;
    outstandingCents: number;
    outstandingDollars: number;
    unpaidDeliveryCount: number;
    hasSavedPaymentMethod: boolean;
    nextInvoiceDate: Date | null;
    // Per-payment failure details — so the dealer dashboard can show
    // "Your charge of $X failed because [reason]. Stripe will retry
    // on [date]." with an "Update payment method" button.
    failedPayments: Array<{
      paymentId: string;
      amount: number;
      failureCode: string | null;
      failureMessage: string | null;
      failedAt: Date | null;
      deliveryId: string;
      pickupAddress: string;
      dropoffAddress: string;
      stripeInvoiceId: string | null;
    }>;
  }> {
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        businessName: true,
        postpaidEnabled: true,
        billingMode: true,
        billingFrozen: true,
        billingFrozenAt: true,
        billingFrozenReason: true,
        postpaidCreditLimitCents: true,
        stripeDefaultPaymentMethodId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!dealer) {
      // Dealer-facing — don't say "Customer not found" (that's our internal
      // Prisma jargon). The dealer calling /me/status already authenticated;
      // if we got here, their account is in a weird state and support is
      // the right next step.
      throw new NotFoundException(
        "We could not load your postpaid billing summary. " +
          "Please contact support and we will get back to you shortly.",
      );
    }

    const outstandingCents = await this.computeOutstandingBalanceCents(dealerId);

    // Count unpaid postpaid deliveries
    const unpaidCount = await this.prisma.payment.count({
      where: {
        delivery: { customerId: dealerId },
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: {
          in: [
            EnumPaymentStatus.PENDING_STRIPE_USAGE,
            EnumPaymentStatus.USAGE_REPORTED,
            EnumPaymentStatus.CHARGE_FAILED,
            EnumPaymentStatus.AUTHORIZED,
            EnumPaymentStatus.INVOICED,
          ],
        },
      },
    });

    // Look up the next upcoming invoice from Stripe (best-effort —
    // returns null if Stripe is unconfigured or no open invoice exists).
    // Stripe SDK v22 renamed `retrieveUpcoming` to `createPreview` —
    // same behavior, new name.
    let nextInvoiceDate: Date | null = null;
    if (this.stripeService && dealer.stripeSubscriptionId) {
      try {
        const upcoming = await this.stripeService.stripe.invoices.createPreview({
          subscription: dealer.stripeSubscriptionId,
        });
        // Stripe's next_payment_attempt is the timestamp we want.
        const ts = (upcoming as any).next_payment_attempt;
        if (ts) {
          nextInvoiceDate = new Date(ts * 1000);
        }
      } catch (err: any) {
        // Likely "no upcoming invoice" — log + continue.
        this.logger.debug(
          `getMyStatus: no upcoming invoice for dealer ${dealerId} (${err?.message})`,
        );
      }
    }

    // ── Fetch failed payments for the dealer dashboard ──
    // The dealer sees per-payment failure details (amount, reason, date)
    // so they know exactly what happened and what to do.
    const failedPayments = await this.prisma.payment.findMany({
      where: {
        delivery: { customerId: dealerId },
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: EnumPaymentStatus.CHARGE_FAILED,
      },
      select: {
        id: true,
        amount: true,
        failureCode: true,
        failureMessage: true,
        failedAt: true,
        stripeInvoiceId: true,
        delivery: {
          select: {
            id: true,
            pickupAddress: true,
            dropoffAddress: true,
          },
        },
      },
      orderBy: { failedAt: 'desc' },
      take: 10,
    });

    return {
      dealerId: dealer.id,
      businessName: dealer.businessName,
      postpaidEnabled: dealer.postpaidEnabled,
      billingMode: dealer.billingMode,
      billingFrozen: dealer.billingFrozen,
      billingFrozenAt: dealer.billingFrozenAt,
      billingFrozenReason: dealer.billingFrozenReason,
      capCents: dealer.postpaidCreditLimitCents,
      outstandingCents,
      outstandingDollars: Number((outstandingCents / 100).toFixed(2)),
      unpaidDeliveryCount: unpaidCount,
      hasSavedPaymentMethod: Boolean(dealer.stripeDefaultPaymentMethodId),
      nextInvoiceDate,
      failedPayments: failedPayments.map((p) => ({
        paymentId: p.id,
        amount: p.amount,
        failureCode: p.failureCode,
        failureMessage: p.failureMessage,
        failedAt: p.failedAt,
        deliveryId: p.delivery.id,
        pickupAddress: p.delivery.pickupAddress,
        dropoffAddress: p.delivery.dropoffAddress,
        stripeInvoiceId: p.stripeInvoiceId,
      })),
    };
  }

  // ─── AUTO-RETRY CRON ────────────────────────────────────────────

  /**
   * Daily job: for every dealer that is currently frozen AND has a
   * saved payment method, attempt to retry the most recent failed
   * weekly invoice. If the retry succeeds, the payment_succeeded
   * webhook will fire and clear the freeze. If it fails again, the
   * webhook re-freezes (no-op due to the idempotency guard above).
   *
   * This unblocks dealers whose card failed once (e.g. expired) and
   * who subsequently added a new card via the saved-card flow,
   * without requiring admin intervention.
   *
   * Called by the @Cron decorator in PostpaidBillingController at
   * 06:00 server time daily.
   */
  async autoRetryFrozenDealers(): Promise<void> {
    if (!this.stripeService) return;

    const frozenDealers = await this.prisma.customer.findMany({
      where: {
        billingFrozen: true,
        stripeSubscriptionId: { not: null },
        stripeDefaultPaymentMethodId: { not: null },
        billingFrozenReason: FREEZE_REASONS.CHARGE_FAILED,
      },
      select: { id: true, businessName: true },
    });

    if (frozenDealers.length === 0) {
      this.logger.debug("autoRetryFrozenDealers: no frozen dealers with saved PM");
      return;
    }

    this.logger.log(
      `autoRetryFrozenDealers: retrying ${frozenDealers.length} frozen dealer(s)`,
    );

    for (const dealer of frozenDealers) {
      try {
        await this.retryFailedCharge(dealer.id);
      } catch (err: any) {
        // Don't let one dealer's failure abort the rest.
        this.logger.warn(
          `autoRetryFrozenDealers: retry for dealer ${dealer.id} failed: ${err?.message}`,
        );
      }
    }
  }

  // ─── invoice.finalized (debug hook) ──────────────────────────────

  /**
   * invoice.finalized — fires when Stripe transitions the weekly
   * invoice from draft to open. Line items are now locked, the
   * customer can see the invoice in their Stripe portal, and the
   * charge will be attempted shortly.
   *
   * We use this only for logging — the actual PAID/FAILED transitions
   * are handled by handleInvoicePaymentSucceeded / Failed.
   */
  async handleInvoiceFinalized(invoiceId: string): Promise<void> {
    if (!this.stripeService) return;
    try {
      const invoice = await this.stripeService.stripe.invoices.retrieve(invoiceId);
      const stripeCustomerId = this.resolveStripeCustomerId(invoice.customer);
      const dealer = stripeCustomerId
        ? await this.prisma.customer.findFirst({
            where: { stripeCustomerId },
            select: { id: true, businessName: true },
          })
        : null;
      this.logger.log(
        `invoice.finalized ${invoiceId}: $${(invoice.total / 100).toFixed(2)} ` +
          `for dealer ${dealer?.businessName ?? dealer?.id ?? "?"} ` +
          `(${(invoice as any).lines?.data?.length ?? 0} line items)`,
      );
    } catch (err: any) {
      this.logger.error(
        `handleInvoiceFinalized failed for invoice ${invoiceId}: ${err?.message}`,
      );
    }
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

  /**
   * Translate a Stripe failure code into a plain-English description
   * for the admin (used in the switch-check block message).
   */
  private describeFailure(code: string): string {
    const map: Record<string, string> = {
      card_declined: 'card was declined by the bank',
      expired_card: 'card has expired',
      incorrect_cvc: 'security code (CVC) is incorrect',
      incorrect_number: 'card number is incorrect',
      insufficient_funds: 'insufficient funds on the card',
      lost_card: 'card was reported lost',
      stolen_card: 'card was reported stolen',
      do_not_honor: 'bank declined the charge (do not honor)',
      processing_error: 'temporary processing error',
      fraudulent: '⚠️ flagged as potentially fraudulent — admin review required',
      security_violation: '⚠️ security violation flagged — admin review required',
      no_card: 'no payment method on file',
      generic_decline: 'card was declined',
      issuer_unavailable: 'bank was temporarily unavailable',
      offline_decline: 'temporary network issue',
    };
    return map[code] || `payment failed (${code})`;
  }
}

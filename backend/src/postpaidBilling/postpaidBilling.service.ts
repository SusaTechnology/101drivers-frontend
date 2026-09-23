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
  EnumDeliveryRequestStatus,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "../providers/stripe/stripe.service";
import { NotificationEventEngine } from "../domain/notificationEvent/notificationEvent.engine";
import { ReferralCreditApplicationService } from "../referral/referral-credit-application.service";
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
    // Inject NotificationEventEngine (optional) so we can notify admins
    // when retry queues reach PERMANENTLY_FAILED / UNCOLLECTIBLE.
    // @Optional guards against circular-DI issues during testing.
    @Optional() private readonly notificationEngine?: NotificationEventEngine,
    // Consumes customer referral credits onto the upcoming weekly invoice
    // (business customers). Provided by PostpaidBillingModule; optional so
    // test harnesses without it still construct.
    @Optional() private readonly referralCreditApplication?: ReferralCreditApplicationService,
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

    // Idempotency: if subscription already exists AND is still active (or
    // pending), just confirm the billing mode is set on the DB and return.
    // If the existing subscription is canceled/expired, we fall through
    // and create a new one (the existing stripeCustomerId is reused, but
    // a new subscription is created with a new ID).
    if (dealer.stripeSubscriptionId) {
      let skipStripeCalls = true;
      if (this.stripeService) {
        try {
          const sub = await this.stripeService.stripe.subscriptions.retrieve(
            dealer.stripeSubscriptionId,
          );
          // active, past_due, trialing, unpaid → keep the existing
          // subscription (Stripe will keep trying to charge it).
          // canceled, incomplete_expired → create a new one.
          if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
            skipStripeCalls = false;
            this.logger.log(
              `Existing subscription ${dealer.stripeSubscriptionId} for dealer ${dealerId} ` +
              `is ${sub.status} — will create a new subscription.`,
            );
          }
        } catch (err: any) {
          // Subscription lookup failed — assume it doesn't exist anymore
          // and create a new one. This is safer than failing the whole
          // setup call.
          skipStripeCalls = false;
          this.logger.warn(
            `Failed to retrieve existing subscription ${dealer.stripeSubscriptionId} ` +
            `for dealer ${dealerId}: ${err.message} — will create a new subscription.`,
          );
        }
      }

      if (skipStripeCalls) {
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
      // Fall through to create a new subscription. The existing
      // stripeCustomerId will be reused (createOrGetCustomer is
      // idempotent on email+metadata).
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
      // No Stripe configured — record the failure so the retry cron can
      // pick it up if Stripe becomes available later. Previously this
      // was a silent skip — the money for the delivery would be lost.
      this.logger.warn(
        `reportUsageToStripe called for delivery ${input.deliveryId} but StripeService is unavailable — scheduled for retry`,
      );
      const payment = await this.prisma.payment.findUnique({
        where: { deliveryId: input.deliveryId },
        select: { id: true, status: true },
      });
      if (payment?.id) {
        await this.scheduleUsageReportRetry(
          payment.id,
          "StripeService unavailable (STRIPE_SECRET_KEY not set)",
        );
      }
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

    // Skip if not a postpaid delivery — prepaid payments were charged
    // at creation; usage reporting doesn't apply to them.
    if (payment.paymentType !== EnumPaymentPaymentType.POSTPAID) {
      return {
        deliveryId: input.deliveryId,
        paymentId: payment.id,
        stripeInvoiceItemId: null,
        status: payment.status as EnumPaymentStatus,
      };
    }

    // paymentType=POSTPAID but the dealer's CURRENT billing mode isn't
    // weekly postpaid (e.g. an admin switched them to prepaid while this
    // delivery was still in flight — switchBillingMode does NOT touch
    // in-flight deliveries). The delivery WAS postpaid — the money is
    // owed — so do NOT skip silently: that is exactly how payments used
    // to get stranded in AUTHORIZED forever (prod: 46 rows / $11,328.16
    // frozen since March). Schedule a retry instead: if the dealer is
    // switched back / re-onboarded, the hourly retry queue heals it;
    // after 5 attempts it becomes PERMANENTLY_FAILED with an admin
    // email, and the daily backfill sweep also retries it once the
    // dealer is back on WEEKLY_POSTPAID.
    if (delivery.customer?.billingMode !== EnumCustomerBillingMode.WEEKLY_POSTPAID) {
      await this.scheduleUsageReportRetry(
        payment.id,
        "Dealer billingMode is not WEEKLY_POSTPAID (billing mode likely switched while this delivery was in flight) — retrying in case it is restored",
      );
      return failure(
        "Dealer is not on weekly-postpaid billing — usage report scheduled for retry",
        payment.id,
        payment.status as EnumPaymentStatus,
      );
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
      const invoiceItem = await this.stripeService.stripe.invoiceItems.create(
        {
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
        },
        {
          // Idempotency key — if the process crashes after Stripe created
          // the InvoiceItem but BEFORE the Payment row update below, the
          // payment row still looks unreported and a retry would create a
          // DUPLICATE InvoiceItem (double bill). Stripe replays the
          // original response for the same key + params (24h window)
          // instead of creating a second item — and every retry path
          // (hourly queue, daily sweep) retries well within 24h.
          idempotencyKey: `postpaid-usage-${payment.id}`,
        },
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripeInvoiceItemId: invoiceItem.id,
          status: EnumPaymentStatus.USAGE_REPORTED,
          // Clear the retry state — usage was successfully reported
          usageReportStatus: null,
          usageReportAttempts: 0,
          usageReportLastError: null,
          usageReportNextRetryAt: null,
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
      // Schedule a retry so the money for this delivery isn't lost.
      // Previously this was a silent failure — admin had no way to know
      // the InvoiceItem was never created. The retry cron will pick it
      // up and try again with exponential backoff.
      await this.scheduleUsageReportRetry(payment.id, msg);
      return failure(msg, payment.id, payment.status as EnumPaymentStatus);
    }
  }

  // ── Usage report retry queue (Fix #1) ──────────────────────────
  //
  // When `reportUsageToStripe` fails (transient Stripe outage, network
  // blip, etc.), the delivery completes but no InvoiceItem is created
  // — the money for that delivery would be lost (the weekly invoice
  // doesn't include it). This helper records the failure on the
  // Payment row with exponential backoff (1h, 2h, 4h, 8h, 24h) so the
  // retry cron (`processUsageReportRetryQueue`) can pick it up.
  //
  // After 5 attempts (total elapsed ~39h), the row is marked
  // PERMANENTLY_FAILED and the admin must manually create the
  // InvoiceItem in the Stripe dashboard.

  private static readonly USAGE_REPORT_MAX_ATTEMPTS = 5;
  // Exponential backoff in minutes: 60, 120, 240, 480, 1440 (1h, 2h, 4h, 8h, 24h)
  private static readonly USAGE_REPORT_BACKOFF_MINUTES = [60, 120, 240, 480, 1440];

  private async scheduleUsageReportRetry(paymentId: string, errorMessage: string): Promise<void> {
    // Read the current attempt count (default 0 for first-time failures)
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { usageReportAttempts: true, usageReportStatus: true },
    });

    const attempts = (payment?.usageReportAttempts ?? 0) + 1;
    const isPermanent =
      attempts >= PostpaidBillingService.USAGE_REPORT_MAX_ATTEMPTS;

    const nextRetryAt = isPermanent
      ? null
      : new Date(
          Date.now() +
            PostpaidBillingService.USAGE_REPORT_BACKOFF_MINUTES[
              Math.min(attempts - 1, PostpaidBillingService.USAGE_REPORT_BACKOFF_MINUTES.length - 1)
            ] *
              60 *
              1000,
        );

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        usageReportStatus: isPermanent ? 'PERMANENTLY_FAILED' : 'FAILED',
        usageReportAttempts: attempts,
        usageReportLastError: errorMessage.slice(0, 500), // cap length
        usageReportNextRetryAt: nextRetryAt,
      },
    });

    if (isPermanent) {
      this.logger.error(
        `Usage report for payment ${paymentId} PERMANENTLY_FAILED after ${attempts} attempts. ` +
          `Admin must manually create the InvoiceItem in Stripe. Last error: ${errorMessage}`,
      );
      // Notify admin(s) so they don't have to actively poll the
      // /admin/health endpoint. Best-effort — failures logged.
      if (this.notificationEngine) {
        try {
          // Look up the deliveryId for this payment so the admin email
          // has full context.
          const paymentRow = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            select: { deliveryId: true },
          });
          if (paymentRow?.deliveryId) {
            await this.notificationEngine.notifyAdminUsageReportPermanentlyFailed({
              paymentId,
              deliveryId: paymentRow.deliveryId,
              attempts,
              lastError: errorMessage.slice(0, 500),
            });
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to send admin notification for permanently failed usage report (payment ${paymentId}): ${err.message}`,
            err?.stack,
          );
        }
      }
    } else {
      this.logger.warn(
        `Usage report for payment ${paymentId} scheduled for retry #${attempts} at ${nextRetryAt?.toISOString()}. Last error: ${errorMessage}`,
      );
    }
  }

  /**
   * Cron entry point — process the usage report retry queue.
   *
   * Finds all Payment rows with `usageReportStatus = FAILED` and
   * `usageReportNextRetryAt <= now()`, and re-runs `reportUsageToStripe`
   * for each. The retry uses the same `reportUsageToStripe` method,
   * which is idempotent (skips if `stripeInvoiceItemId` is already set).
   *
   * On success: `usageReportStatus` is cleared (set to null) by
   * `reportUsageToStripe` itself.
   * On failure: `scheduleUsageReportRetry` is called again, which
   * increments the attempt count + schedules the next retry (or
   * marks as PERMANENTLY_FAILED if max attempts exceeded).
   *
   * Designed to be called by a @Cron(EVERY_HOUR) decorator. Safe to
   * call manually for testing. Idempotent — concurrent cron runs
   * won't double-charge because `reportUsageToStripe` checks the
   * `stripeInvoiceItemId` first.
   */
  async processUsageReportRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const due = await this.prisma.payment.findMany({
      where: {
        usageReportStatus: 'FAILED',
        usageReportNextRetryAt: { lte: new Date() },
        // Only postpaid deliveries need usage reporting
        paymentType: 'POSTPAID',
        // Skip if already reported (defensive — idempotency guard in
        // reportUsageToStripe also catches this)
        stripeInvoiceItemId: null,
      },
      select: { id: true, deliveryId: true },
      take: 50, // batch size — don't overwhelm Stripe
    });

    if (due.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.logger.log(
      `Usage report retry queue: processing ${due.length} payment(s)`,
    );

    let succeeded = 0;
    let failed = 0;

    for (const item of due) {
      try {
        const result = await this.reportUsageToStripe({ deliveryId: item.deliveryId });
        if (result.stripeInvoiceItemId) {
          succeeded++;
        } else {
          // reportUsageToStripe already scheduled the next retry
          failed++;
        }
      } catch (err: any) {
        // reportUsageToStripe is non-throwing by design — this catch
        // is a safety net for unexpected errors.
        this.logger.error(
          `Usage report retry threw for delivery ${item.deliveryId}: ${err.message}`,
          err?.stack,
        );
        await this.scheduleUsageReportRetry(item.id, `Retry threw: ${err.message}`);
        failed++;
      }
    }

    this.logger.log(
      `Usage report retry queue: ${succeeded} succeeded, ${failed} failed of ${due.length} processed`,
    );

    return { processed: due.length, succeeded, failed };
  }

  // ── Mid-trip card removal — remainder charge retry queue (Fix #7) ──
  //
  // When a business prepaid customer removes their card between startTrip
  // and completeTrip, the remainder capture fails. The Payment row is
  // marked with `remainderChargeStatus = PENDING` + `remainderAmount` +
  // `remainderDueAt = now + 7 days`.
  //
  // This cron finds those rows and retries the charge. If the customer
  // has since added a new card, the charge succeeds → mark as CAPTURED +
  // clear the remainder fields. If still no card, leave it PENDING.
  // After 7 days, mark as UNCOLLECTIBLE + admin must manually invoice.
  //
  // Designed to be called by a @Cron(EVERY_DAY_AT_6AM) decorator.

  async processRemainderChargeRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number; uncollectible: number }> {
    if (!this.stripeService) {
      return { processed: 0, succeeded: 0, failed: 0, uncollectible: 0 };
    }

    // Find all PENDING remainder charges
    const due = await this.prisma.payment.findMany({
      where: {
        remainderChargeStatus: 'PENDING',
        paymentType: 'PREPAID',
      },
      select: {
        id: true,
        deliveryId: true,
        remainderAmount: true,
        remainderDueAt: true,
      },
      take: 50,
    });

    if (due.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, uncollectible: 0 };
    }

    let succeeded = 0;
    let failed = 0;
    let uncollectible = 0;

    for (const item of due) {
      const now = new Date();
      const dueAt = item.remainderDueAt ?? new Date(0);

      // Check if we've passed the 7-day uncollectible deadline
      if (now > dueAt) {
        await this.prisma.payment.update({
          where: { id: item.id },
          data: { remainderChargeStatus: 'UNCOLLECTIBLE' as any },
        });
        uncollectible++;
        this.logger.warn(
          `Remainder charge for payment ${item.id} (delivery ${item.deliveryId}) marked UNCOLLECTIBLE — past 7-day deadline. Admin must manually invoice.`,
        );
        // Notify admin(s). Best-effort — failures logged.
        if (this.notificationEngine) {
          try {
            await this.notificationEngine.notifyAdminRemainderUncollectible({
              paymentId: item.id,
              deliveryId: item.deliveryId,
              remainderAmount: item.remainderAmount ?? 0,
              dueAt: dueAt.toISOString(),
            });
          } catch (err: any) {
            this.logger.error(
              `Failed to send admin notification for uncollectible remainder (payment ${item.id}): ${err.message}`,
              err?.stack,
            );
          }
        }
        continue;
      }

      // Try to charge the remainder
      try {
        const delivery = await this.prisma.deliveryRequest.findUnique({
          where: { id: item.deliveryId },
          select: {
            id: true,
            customer: {
              select: {
                id: true,
                stripeCustomerId: true,
                stripeDefaultPaymentMethodId: true,
                contactEmail: true,
                user: { select: { email: true } },
              },
            },
          },
        });

        if (!delivery?.customer?.stripeCustomerId || !delivery?.customer?.stripeDefaultPaymentMethodId) {
          // Customer still has no saved card — leave as PENDING for the next cron run
          this.logger.log(
            `Remainder charge for payment ${item.id}: customer still has no saved card — leaving PENDING`,
          );
          failed++;
          continue;
        }

        // Attempt the remainder charge
        const amount = item.remainderAmount ?? 0;
        if (amount <= 0) {
          await this.prisma.payment.update({
            where: { id: item.id },
            data: {
              remainderChargeStatus: null,
              remainderAmount: null,
              remainderDueAt: null,
            },
          });
          continue;
        }

        const pi = await this.stripeService.createPaymentIntent({
          amount,
          deliveryId: delivery.id,
          stripeCustomerId: delivery.customer.stripeCustomerId,
          paymentMethodId: delivery.customer.stripeDefaultPaymentMethodId,
          captureMethod: 'automatic',
          confirm: true,
          metadata: {
            deliveryId: delivery.id,
            type: 'remainder-retry',
          },
          // Stable idempotency key — the daily cron retries this same
          // charge. Using the same key means Stripe returns the same PI
          // instead of creating a new one → no double charge across
          // multiple cron runs.
          idempotencyKey: `pi-remainder-${delivery.id}`,
        });

        // Re-fetch to learn the true status
        const refreshedPi = await this.stripeService.getPaymentIntent(pi.paymentIntentId);
        if (refreshedPi.status === 'succeeded') {
          // Successfully captured the remainder
          await this.prisma.payment.update({
            where: { id: item.id },
            data: {
              status: EnumPaymentStatus.CAPTURED,
              capturedAt: new Date(),
              // Clear the remainder fields
              remainderChargeStatus: null,
              remainderAmount: null,
              remainderDueAt: null,
              failureMessage: null,
            },
          });
          succeeded++;
          this.logger.log(
            `Remainder charge retry SUCCEEDED for payment ${item.id} (delivery ${item.deliveryId}): $${amount.toFixed(2)}`,
          );
        } else {
          // PI didn't succeed — mark as RETRIED but keep PENDING for next cron run
          await this.prisma.payment.update({
            where: { id: item.id },
            data: { remainderChargeStatus: 'RETRIED' as any },
          });
          // Re-set to PENDING for the next cron run
          await this.prisma.payment.update({
            where: { id: item.id },
            data: { remainderChargeStatus: 'PENDING' as any },
          });
          failed++;
          this.logger.warn(
            `Remainder charge retry failed for payment ${item.id} (delivery ${item.deliveryId}) — status: ${refreshedPi.status}`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `Remainder charge retry threw for payment ${item.id} (delivery ${item.deliveryId}): ${err.message}`,
          err?.stack,
        );
        failed++;
      }
    }

    this.logger.log(
      `Remainder charge retry queue: ${succeeded} succeeded, ${failed} failed, ${uncollectible} uncollectible of ${due.length} processed`,
    );

    return { processed: due.length, succeeded, failed, uncollectible };
  }

  // ── Multi-invoice retry (Fix #8) ──
  //
  // The old `retryFailedCharge` only retried the MOST RECENT open
  // invoice. If a dealer had 3 weeks of failed invoices, only the most
  // recent was retried — older ones were left to be auto-marked
  // uncollectible by Stripe after 30 days.
  //
  // This method retries ALL open invoices for the dealer's
  // subscription. Used by the daily auto-retry cron (replaces the
  // single-invoice retry) + a new admin endpoint to manually trigger
  // a bulk retry.

  async retryAllFailedCharges(dealerId: string): Promise<{ invoicesRetried: number; succeeded: number; failed: number; skippedNoCard?: number }> {
    if (!this.stripeService) {
      throw new Error("StripeService unavailable");
    }

    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    });
    if (!dealer?.stripeSubscriptionId) {
      throw new BadRequestException("Dealer has no Stripe subscription");
    }

    // List all open invoices for this subscription
    const invoices = await this.stripeService.stripe.invoices.list({
      subscription: dealer.stripeSubscriptionId,
      limit: 50,
      status: 'open',
    });

    if (!invoices.data || invoices.data.length === 0) {
      return { invoicesRetried: 0, succeeded: 0, failed: 0 };
    }

    this.logger.log(
      `Bulk retry: ${invoices.data.length} open invoice(s) for dealer ${dealerId}`,
    );

    // ── Pre-pay guard (B2) ──
    // Confirm the Stripe customer actually HAS a default_payment_method
    // before calling invoices.pay. Without it every attempt is a guaranteed
    // 402 code=missing ("no default_payment_method set on the associated
    // Customer, Invoice, or Subscription") — pure Stripe log noise on every
    // cron run for dealers who simply haven't saved a card yet.
    //
    // We check STRIPE's field, not our DB's stripeDefaultPaymentMethodId —
    // the two can drift (the old best-effort write), and Stripe's field is
    // what invoices.pay actually reads. With B1 (verify-after-write) and B3
    // (pay-kick on card save) in place, the moment a dealer saves a card the
    // default is set and retried immediately — skipping here costs nothing.
    const invoiceCustomer = invoices.data[0]?.customer;
    const stripeCustomerId =
      (typeof invoiceCustomer === "string" ? invoiceCustomer : invoiceCustomer?.id) ??
      dealer.stripeCustomerId ??
      null;

    if (stripeCustomerId) {
      const cust = await this.stripeService.stripe.customers.retrieve(stripeCustomerId);
      const rawDefault = (cust as any).invoice_settings?.default_payment_method;
      const stripeDefaultPm = typeof rawDefault === "string" ? rawDefault : rawDefault?.id ?? null;

      if (!stripeDefaultPm) {
        this.logger.warn(
          `Bulk retry skipped for dealer ${dealerId}: Stripe customer ${stripeCustomerId} has no default_payment_method — nothing to charge (NO_SAVED_CARD). Dealer must save a card first; no retry can succeed until then.`,
        );
        return { invoicesRetried: 0, succeeded: 0, failed: 0, skippedNoCard: invoices.data.length };
      }
    }

    let succeeded = 0;
    let failed = 0;

    for (const inv of invoices.data) {
      try {
        await this.stripeService.stripe.invoices.pay(inv.id);
        succeeded++;
        this.logger.log(
          `Retry succeeded for invoice ${inv.id} (dealer ${dealerId})`,
        );
      } catch (err: any) {
        failed++;
        this.logger.warn(
          `Retry failed for invoice ${inv.id} (dealer ${dealerId}): ${err.message}`,
        );
      }
      // Small delay to avoid Stripe rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return { invoicesRetried: invoices.data.length, succeeded, failed };
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

      // ── Auto-apply pending referral credits to THIS invoice ──
      // invoice.upcoming fires ~1 hour before finalization — the documented
      // Stripe window for last-minute invoice items. The dealer's oldest
      // PENDING referral credits are consumed (FIFO, capped at the invoice
      // total) and a NEGATIVE InvoiceItem is created so Stripe sweeps the
      // credit into this invoice. Fail-safe: never blocks the rest.
      if (this.referralCreditApplication) {
        await this.referralCreditApplication.applyPostpaidCreditsToUpcomingInvoice({
          dealerId: dealer.id,
          stripeCustomerId,
          invoiceTotalCents: invoice.total ?? null,
        });
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

      // Schema-proof extraction — `line.invoiceitem` does NOT exist on
      // dahlia (our pinned API version); the id lives at
      // line.parent.invoice_item_details.invoice_item. Reading only the
      // legacy field returned [] on EVERY invoice, which made this handler
      // look exactly like a "$0 anchor" invoice and silently mark ZERO
      // Payment rows PAID.
      let invoiceItemIds = this.extractInvoiceItemIds(invoice);
      if (invoiceItemIds.length === 0) {
        // Bulletproof fallback: list the InvoiceItems attached to this
        // invoice directly — independent of how line items are rendered.
        try {
          const items = await this.stripeService!.stripe.invoiceItems.list({
            invoice: invoiceId,
            limit: 100,
          });
          invoiceItemIds = items.data.map((i: any) => i.id);
        } catch {
          // keep empty — the "nothing to mark" branch below handles it
        }
      }

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

      // ── Fix 2: Auto-unfreeze dealer if they were frozen due to CHARGE_FAILED ──
      // When a frozen dealer replaces their card and the daily cron retries
      // the invoice, the retry charges the NEW card (because Fix 1 updated
      // invoice_settings.default_payment_method). If the charge succeeds,
      // this webhook fires. We auto-clear the freeze so the dealer can
      // create deliveries again — no admin intervention needed.
      //
      // The dealer is resolved from the Stripe customer ID on the invoice.
      // We only clear the freeze if the reason was CHARGE_FAILED (not
      // other freeze reasons like fraud).
      const stripeCustomerId = this.resolveStripeCustomerId(invoice.customer);
      if (stripeCustomerId) {
        const dealer = await this.prisma.customer.findFirst({
          where: { stripeCustomerId },
          select: { id: true, billingFrozen: true, billingFrozenReason: true },
        });
        if (dealer?.billingFrozen && dealer.billingFrozenReason === FREEZE_REASONS.CHARGE_FAILED) {
          await this.prisma.customer.update({
            where: { id: dealer.id },
            data: {
              billingFrozen: false,
              billingFrozenAt: null,
              billingFrozenReason: null,
            },
          });
          this.logger.log(
            `Auto-unfroze dealer ${dealer.id} — invoice ${invoiceId} payment succeeded after retry`,
          );
        }
      }
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

      // Schema-proof extraction (see handleInvoicePaymentSucceeded) — the
      // legacy line.invoiceitem field is gone on dahlia, which killed the
      // primary match-by-item path and pushed every failure into the
      // stripeInvoiceId fallback — which matches 0 rows on the FIRST
      // failure because nothing ever stamps stripeInvoiceId anymore.
      let invoiceItemIds = this.extractInvoiceItemIds(invoice);
      if (invoiceItemIds.length === 0) {
        try {
          const items = await this.stripeService!.stripe.invoiceItems.list({
            invoice: invoiceId,
            limit: 100,
          });
          invoiceItemIds = items.data.map((i: any) => i.id);
        } catch {
          // keep empty — the stripeInvoiceId fallback below still runs
        }
      }

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

      // ── Webhook redelivery guard (for the dealer notification below) ──
      // Stripe retries webhook deliveries. The DB updates below are
      // idempotent (re-marking CHARGE_FAILED is a no-op), but the dealer
      // email must NOT be re-sent for the same attempt. If any Payment
      // row for this invoice already records an attemptCount >= this
      // event's attemptCount, we have already processed — and notified
      // about — this attempt.
      const priorAttemptRow =
        invoiceItemIds.length > 0
          ? await this.prisma.payment.findFirst({
              where: {
                stripeInvoiceItemId: { in: invoiceItemIds },
                attemptCount: { gte: attemptCount },
              },
              select: { id: true },
            })
          : await this.prisma.payment.findFirst({
              where: {
                stripeInvoiceId: invoiceId,
                attemptCount: { gte: attemptCount },
              },
              select: { id: true },
            });
      const alreadyProcessedAttempt = !!priorAttemptRow;

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

      // ── Dealer notification (email + bell) ──────────────────────
      // The dashboard banner is only visible on login — without this,
      // a dealer could stay unaware for the entire retry window and
      // discover the restriction only when a delivery is blocked.
      // Graduated copy mirrors the banners: attempt 1 = heads-up,
      // 2 = final warning, 3+/critical = restricted + unblock steps.
      // Transient errors stay silent (they self-heal — matches the UI).
      // Redelivered webhooks are deduped by the prior-attempt guard above.
      if (stripeCustomerId && !isTransient && !alreadyProcessedAttempt) {
        try {
          const dealer = await this.prisma.customer.findFirst({
            where: { stripeCustomerId },
            select: { id: true },
          });
          if (dealer && this.notificationEngine) {
            await this.notificationEngine.notifyDealerInvoicePaymentFailed({
              customerId: dealer.id,
              attemptCount,
              amountDollars:
                (invoice as any).amount_due != null
                  ? (invoice as any).amount_due / 100
                  : null,
              failureReason: isCritical ? null : failureMessage,
              nextRetryAt: nextRetryAttempt,
              restricted: shouldRestrict,
              critical: isCritical,
            });
          }
        } catch (notifyErr: any) {
          // A notification failure must never break the webhook path.
          this.logger.warn(
            `handleInvoicePaymentFailed: dealer notification failed for invoice ${invoiceId}: ${notifyErr?.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `handleInvoicePaymentFailed failed for invoice ${invoiceId}: ${err?.message}`,
      );
    }
  }

  // ─── INVOICE WRITE-OFF HANDLERS ─────────────────────────────────
  //
  // Stripe stops collecting an invoice in two ways:
  //   • invoice.voided               — an admin cancelled it in the
  //                                    Stripe dashboard (deliberate
  //                                    forgiveness / correction).
  //   • invoice.marked_uncollectible — Stripe's automatic write-off
  //                                    after its final retry (dashboard
  //                                    "mark uncollectible" setting).
  //
  // Before these handlers existed, both events were silently ignored:
  // the Payment rows stayed CHARGE_FAILED forever and a dealer frozen
  // for CHARGE_FAILED had NO self-serve path out — no retry can ever
  // succeed on a closed invoice. Same "stranded state" class of bug as
  // the $11,328 AUTHORIZED case, just on the failure side.

  /**
   * invoice.voided — the invoice was cancelled, the debt no longer
   * exists. Marks all non-PAID Payment rows on the invoice as VOIDED
   * (excluded from outstanding balance) and auto-unfreezes a
   * CHARGE_FAILED-frozen dealer.
   */
  async handleInvoiceVoided(invoiceId: string): Promise<void> {
    await this.resolveWrittenOffInvoice(invoiceId, "voided");
  }

  /**
   * invoice.marked_uncollectible — Stripe gave up retrying (final
   * write-off). Payment rows keep their failed state for the record
   * (the money is still nominally owed — an admin decides what happens
   * to it); the dealer is auto-unfroze so a closed invoice can never
   * trap the account, and admins get the collect-or-forgive email.
   */
  async handleInvoiceMarkedUncollectible(invoiceId: string): Promise<void> {
    await this.resolveWrittenOffInvoice(invoiceId, "uncollectible");
  }

  /**
   * Shared body for both write-off webhooks. Never throws — there is
   * nothing retryable here, and a throwing handler would only make
   * Stripe redeliver the event forever.
   */
  private async resolveWrittenOffInvoice(
    invoiceId: string,
    mode: "voided" | "uncollectible",
  ): Promise<void> {
    if (!this.stripeService) return;
    try {
      const invoice = await this.stripeService.stripe.invoices
        .retrieve(invoiceId)
        .catch(() => null);
      const stripeCustomerId = invoice
        ? this.resolveStripeCustomerId(invoice.customer)
        : null;
      const amountDollars =
        invoice && (invoice as any).amount_due != null
          ? (invoice as any).amount_due / 100
          : null;

      // Resolve the dealer first (needed for the unfreeze + notifications).
      const dealer = stripeCustomerId
        ? await this.prisma.customer.findFirst({
            where: { stripeCustomerId },
            select: {
              id: true,
              billingFrozen: true,
              billingFrozenReason: true,
            },
          })
        : null;

      if (mode === "voided") {
        // The debt is cancelled — every non-PAID row on this invoice is
        // no longer collectible. VOIDED rows are excluded from the
        // outstanding-balance calculation (same rule the $11,328 sweep
        // relies on), so the dealer's numbers stay honest. Re-delivered
        // webhooks are naturally idempotent (re-voiding is a no-op).
        const result = await this.prisma.payment.updateMany({
          where: {
            stripeInvoiceId: invoiceId,
            status: { not: EnumPaymentStatus.PAID },
          },
          data: {
            status: EnumPaymentStatus.VOIDED,
            voidedAt: new Date(),
          },
        });
        this.logger.log(
          `handleInvoiceVoided ${invoiceId}: marked ${result.count} Payment row(s) VOIDED`,
        );
      }

      // ── Auto-unfreeze: a closed invoice can never succeed on retry,
      // so a CHARGE_FAILED freeze would otherwise be a life sentence.
      // The postpaid cap still limits the dealer's ongoing exposure,
      // and admins can re-freeze manually if they disagree.
      if (
        dealer?.billingFrozen &&
        dealer.billingFrozenReason === FREEZE_REASONS.CHARGE_FAILED
      ) {
        await this.prisma.customer.update({
          where: { id: dealer.id },
          data: {
            billingFrozen: false,
            billingFrozenAt: null,
            billingFrozenReason: null,
          },
        });
        this.logger.log(
          `Auto-unfroze dealer ${dealer.id} — invoice ${invoiceId} was ${mode === "voided" ? "voided" : "marked uncollectible"}`,
        );
      }

      // ── Notifications: admins get the money decision, the dealer gets
      // the "you're unblocked" closure. Notification failures are logged
      // and swallowed — they must never fail the webhook.
      if (this.notificationEngine) {
        try {
          await this.notificationEngine.notifyAdminInvoiceWrittenOff({
            invoiceId,
            customerId: dealer?.id ?? null,
            amountDollars,
            reason: mode,
          });
        } catch (err: any) {
          this.logger.warn(
            `resolveWrittenOffInvoice: admin notification failed for invoice ${invoiceId}: ${err?.message}`,
          );
        }
        if (dealer) {
          try {
            await this.notificationEngine.notifyDealerInvoiceResolved({
              customerId: dealer.id,
              outcome: mode === "voided" ? "cancelled" : "written_off",
              amountDollars,
            });
          } catch (err: any) {
            this.logger.warn(
              `resolveWrittenOffInvoice: dealer notification failed for invoice ${invoiceId}: ${err?.message}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `resolveWrittenOffInvoice(${mode}) failed for invoice ${invoiceId}: ${err?.message}`,
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
   * Prepaid → Postpaid (AUTO-SETUP, the "big system" pattern):
   *   - Sets postpaidEnabled = true + billingMode = WEEKLY_POSTPAID
   *   - If an existing Stripe subscription is found (previously cancelled at
   *     period end when the dealer was switched to prepaid), it is REACTIVATED
   *     by setting cancel_at_period_end = false.
   *   - If NO existing Stripe subscription is found, the system
   *     ATOMICALLY creates the Stripe customer + $0/week anchor
   *     subscription in the SAME request. If the Stripe API call fails,
   *     the billing mode flag is ROLLED BACK — the dealer stays on
   *     prepaid. This guarantees the invariant:
   *
   *       billingMode = WEEKLY_POSTPAID → stripeSubscriptionId IS NOT NULL
   *
   *     so no dealer can ever be on postpaid billing without a working
   *     Stripe subscription. The admin no longer needs to remember to
   *     click "Setup Postpaid" after switching — it's automatic.
   *
   *     Setup-upon-switch was added because the previous behavior (flag
   *     flipped + manual "Setup Postpaid" button click) had a gap: the
   *     admin could navigate away from the page after the switch without
   *     setting the dealer up, leaving the dealer on postpaid billing
   *     with no subscription. The dealer couldn't create deliveries
   *     (canDealerCreateDelivery returns NO_SUBSCRIPTION), but the
   *     admin's intent (postpaid) wasn't honored. With auto-setup, the
   *     switch either fully succeeds (Stripe customer + subscription
   *     created + flags flipped) OR fully fails (no state change).
   *
   * Returns a structured result so the frontend can show the right
   * message (existing subscription reactivated vs. new setup created vs.
   * error).
   */
  async switchBillingMode(
    dealerId: string,
    newMode: 'PREPAID' | 'POSTPAID',
  ): Promise<{
    mode: 'PREPAID' | 'POSTPAID';
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    subscriptionReactivated: boolean;
    /** True when a brand-new Stripe customer + subscription was created
     *  by this switch (vs. reactivating an existing one). */
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
    // AUTO-SETUP pattern: flip the customer flags first, then create the
    // Stripe customer + subscription. If Stripe setup fails, ROLL BACK
    // the flag flip so the dealer stays on prepaid — no half-state.
    const previousBillingMode = (await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: { billingMode: true, postpaidEnabled: true },
    }))!;

    await this.prisma.customer.update({
      where: { id: dealerId },
      data: {
        postpaidEnabled: true,
        billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
      },
    });

    let subscriptionReactivated = false;
    let setupRequired = false;
    let needNewSetup = true; // true unless we successfully reactivate below

    // 2. If an existing subscription is present, REACTIVATE it. When the
    //    dealer was previously switched to prepaid, we set
    //    cancel_at_period_end=true on the subscription. As long as the
    //    current billing period hasn't ended, the subscription is still
    //    "active" and can be un-cancelled by setting cancel_at_period_end
    //    back to false. If the period already ended and the subscription
    //    is fully canceled, we fall through to the "create new
    //    subscription" path via setupDealerForPostpaid.
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
          needNewSetup = false;
          this.logger.log(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `re-activated (cancel_at_period_end=false) on switch to postpaid`,
          );
        } else if (sub.status === 'active') {
          // Already active and not marked for cancellation — nothing to do
          subscriptionReactivated = true;
          needNewSetup = false;
          this.logger.log(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `already active — no reactivation needed`,
          );
        } else {
          // Subscription is canceled/expired/unpaid — fall through to
          // setupDealerForPostpaid below to create a NEW subscription.
          // setupDealerForPostpaid is idempotent: it will reuse the
          // existing stripeCustomerId but create a new subscription.
          this.logger.warn(
            `Subscription ${eligibility.stripeSubscriptionId} for dealer ${dealerId} ` +
            `is in status ${sub.status} — will create a new subscription via setupDealerForPostpaid`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to retrieve/re-activate subscription ${eligibility.stripeSubscriptionId} ` +
          `for dealer ${dealerId}: ${err.message} — will attempt setupDealerForPostpaid.`,
        );
      }
    }

    // 3. If no existing subscription could be reactivated, AUTO-CREATE
    //    the Stripe customer + $0/week anchor subscription. This is the
    //    "big system" invariant: by the time switchBillingMode returns
    //    successfully, the dealer MUST have a stripeSubscriptionId.
    //
    //    If setupDealerForPostpaid throws (Stripe API error, missing
    //    config, etc.), we ROLL BACK the flag flip so the dealer stays
    //    on prepaid. This prevents the half-state where the admin sees
    //    "postpaidEnabled = true" but the dealer can't actually create
    //    deliveries because no subscription exists.
    if (needNewSetup) {
      try {
        await this.setupDealerForPostpaid(dealerId);
        setupRequired = true;
        this.logger.log(
          `Auto-setup completed for dealer ${dealerId} during switch to postpaid`,
        );
      } catch (err: any) {
        // Roll back the flag flip — the dealer stays on prepaid.
        this.logger.error(
          `Auto-setup failed for dealer ${dealerId} during switch to postpaid: ${err.message} — ` +
          `rolling back billing mode to ${previousBillingMode.billingMode}.`,
        );
        await this.prisma.customer.update({
          where: { id: dealerId },
          data: {
            postpaidEnabled: previousBillingMode.postpaidEnabled,
            billingMode: previousBillingMode.billingMode,
          },
        });
        throw new BadRequestException(
          `Failed to set up postpaid billing: ${err.message}. ` +
          `The dealer remains on prepaid billing. Fix the underlying issue ` +
          `(e.g. Stripe configuration) and try the switch again.`,
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
      `(reactivated=${subscriptionReactivated}, newSetup=${setupRequired}, ` +
      `subscriptionId=${updated?.stripeSubscriptionId ?? 'null'})`,
    );

    return {
      mode: 'POSTPAID',
      stripeCustomerId: updated?.stripeCustomerId ?? null,
      stripeSubscriptionId: updated?.stripeSubscriptionId ?? null,
      subscriptionReactivated,
      setupRequired,
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
   * Retry the dealer's failed weekly invoice(s) from an admin action.
   *
   * Delegates to retryAllFailedCharges() — which pays EVERY open invoice
   * on the subscription (the 6AM cron path, proven in production) — so
   * the admin button and the cron behave identically. A dealer with 3
   * weeks of failed invoices gets all 3 retried, not just the newest.
   *
   * Historical bug this replaces: the old implementation called
   * `invoices.pay(id, { paid_out_of_band: false })` — Stripe rejects any
   * `paid_out_of_band` value except the string 'true' (the parameter
   * means "mark paid as collected outside Stripe" and is only ever
   * passed as true), so EVERY manual retry 400'd with
   * "invalid_paid_out_of_band_parameter". retryAllFailedCharges already
   * called `invoices.pay(id)` correctly.
   *
   * When the subscription has NO open invoice, this throws a 400 that
   * explains WHY and what to do — the failed invoice is closed (voided /
   * marked uncollectible / already paid), and Stripe can never re-charge
   * a closed invoice. Vague "No open invoice found" errors left admins
   * stuck with no next step.
   */
  async retryFailedCharge(
    dealerId: string,
  ): Promise<{ invoicesRetried: number; succeeded: number; failed: number }> {
    if (!this.stripeService) {
      throw new Error("StripeService unavailable");
    }
    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: { id: true, stripeSubscriptionId: true, stripeCustomerId: true },
    });
    if (!dealer?.stripeSubscriptionId) {
      throw new BadRequestException(
        "Dealer has no Stripe subscription — retry impossible",
      );
    }

    const result = await this.retryAllFailedCharges(dealerId);

    // B2: open invoices exist but were SKIPPED because the Stripe customer
    // has no default_payment_method. Say THAT, not "no open invoice" —
    // otherwise admins chase the wrong fix.
    if (result.skippedNoCard && result.skippedNoCard > 0) {
      throw new BadRequestException(
        `Dealer has ${result.skippedNoCard} open invoice(s) but NO card to charge — ` +
        `the Stripe customer (${dealer.stripeCustomerId ?? "unknown"}) has no default payment method. ` +
        `Ask the dealer to save a card in the app (open invoices are then charged automatically), ` +
        `or set a default card on that customer in the Stripe dashboard and retry.`,
      );
    }

    if (result.invoicesRetried === 0) {
      throw new BadRequestException(
        await this.explainNoOpenInvoice(dealer.stripeSubscriptionId),
      );
    }

    // Stripe will fire invoice.payment_succeeded or .payment_failed per
    // invoice shortly; our webhook handlers update Payment rows + freeze
    // state.
    this.logger.log(
      `Admin retry for dealer ${dealerId}: ${result.succeeded}/${result.invoicesRetried} invoice(s) retried successfully`,
    );
    return result;
  }

  /**
   * Build a human, decision-ready explanation for "no open invoice to
   * retry". Looks at the subscription's recent invoices to say WHICH
   * state they're in and what the admin should do instead.
   */
  private async explainNoOpenInvoice(subscriptionId: string): Promise<string> {
    try {
      const recent = await this.stripeService!.stripe.invoices.list({
        subscription: subscriptionId,
        limit: 10,
      });

      const writtenOff = recent.data.find(
        (inv) => inv.status === "uncollectible" || inv.status === "void",
      );
      if (writtenOff) {
        const whatHappened =
          writtenOff.status === "void"
            ? "was voided (cancelled)"
            : "was written off as uncollectible after the retry window";
        return (
          `The failed invoice (${writtenOff.number ?? writtenOff.id}) ${whatHappened}, so Stripe can no longer re-charge it. ` +
          `To collect: take payment from the dealer directly (or have them pay the open amount), then use "Mark Paid" on the payment — ` +
          `or let the next weekly invoice run and forgive the remainder.`
        );
      }

      if (recent.data.some((inv) => inv.status === "paid")) {
        return (
          "The most recent invoice was already paid — the payment list updates as soon as the Stripe webhook lands. " +
          "Refresh in a few seconds; if rows still show failed after a minute, use Unfreeze to re-enable the dealer."
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `explainNoOpenInvoice: could not inspect invoices for ${subscriptionId}: ${err?.message}`,
      );
    }
    return (
      "No open invoice found for this dealer's subscription — the failed invoice is closed, so there is nothing for Stripe to re-charge. " +
      "If the dealer still owes money, collect it manually and use Mark Paid on the payment."
    );
  }

  // ─── ADMIN: FLEET BILLING HEALTH ────────────────────────────────

  /**
   * Fleet-level view for the admin "Billing Health" page — WHO needs
   * help right now, by name. Complements GET /admin/health (which
   * returns queue counts but no identities), so an admin no longer
   * has to open dealer profiles one by one to find who's stuck.
   *
   * Three lists:
   *   • frozenDealers — billingFrozen=true. These dealers cannot create
   *     deliveries. Actionable via the existing per-dealer endpoints
   *     (retry-charge / unfreeze) which the page calls inline.
   *   • warningDealers — NOT frozen but have ≥1 CHARGE_FAILED postpaid
   *     payment (attempt 1-2 under the graduated policy). Early
   *     intervention here prevents the freeze entirely.
   *   • uncollectiblePayments — remainder charges written off after 7
   *     days of retries. The system cannot collect these automatically;
   *     an admin must contact the dealer / invoice manually.
   *
   * All lists are bounded (take limits) so a pathological dataset can't
   * make the endpoint heavy, and everything is computed in 4 bulk
   * queries (no N+1 per dealer).
   */
  async getBillingHealthOverview(): Promise<{
    frozenDealers: Array<{
      dealerId: string;
      businessName: string | null;
      contactEmail: string | null;
      billingFrozenAt: string | null;
      billingFrozenReason: string | null;
      hasSavedCard: boolean;
      hasSubscription: boolean;
      capCents: number | null;
      outstandingCents: number;
      outstandingDollars: number;
      unpaidDeliveryCount: number;
      failedPaymentCount: number;
      lastFailureAt: string | null;
      lastFailureCode: string | null;
      maxAttemptCount: number | null;
    }>;
    warningDealers: Array<{
      dealerId: string;
      businessName: string | null;
      contactEmail: string | null;
      hasSavedCard: boolean;
      hasSubscription: boolean;
      capCents: number | null;
      failedPaymentCount: number;
      failedAmountDollars: number;
      lastFailureAt: string | null;
      lastFailureCode: string | null;
      maxAttemptCount: number | null;
    }>;
    uncollectiblePayments: Array<{
      paymentId: string;
      deliveryId: string;
      dealerId: string;
      businessName: string | null;
      amount: number;
      amountDollars: number;
      writtenOffAt: string | null;
    }>;
    reconciliationFindings: Array<{
      id: string;
      customerId: string;
      businessName: string | null;
      check: string;
      severity: string;
      detail: string;
      expectedValue: string | null;
      actualValue: string | null;
      repairedAt: string | null;
      createdAt: string;
    }>;
    totals: {
      frozenCount: number;
      warningCount: number;
      uncollectibleCount: number;
      frozenOutstandingCents: number;
      frozenOutstandingDollars: number;
      reconciliationOpenCount: number;
    };
  }> {
    // ── 1. Frozen dealers (longest-frozen first — they've been blocked longest) ──
    const frozen = await this.prisma.customer.findMany({
      where: { billingFrozen: true },
      select: {
        id: true,
        businessName: true,
        billingFrozenAt: true,
        billingFrozenReason: true,
        stripeDefaultPaymentMethodId: true,
        stripeSubscriptionId: true,
        postpaidCreditLimitCents: true,
        user: { select: { email: true } },
      },
      orderBy: { billingFrozenAt: "asc" },
      take: 100,
    });

    // ── 2. All unpaid postpaid payments for those dealers — ONE query,
    //      grouped in JS (avoids N+1 computeOutstandingBalanceCents calls) ──
    const frozenIds = frozen.map((d) => d.id);
    const frozenPayments =
      frozenIds.length === 0
        ? []
        : await this.prisma.payment.findMany({
            where: {
              delivery: { customerId: { in: frozenIds } },
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
            select: {
              amount: true,
              status: true,
              failureCode: true,
              failedAt: true,
              attemptCount: true,
              delivery: { select: { customerId: true } },
            },
          });

    interface DealerAgg {
      outstandingCents: number;
      unpaidDeliveryCount: number;
      failedPaymentCount: number;
      lastFailureAt: Date | null;
      lastFailureCode: string | null;
      maxAttemptCount: number;
    }
    const aggByDealer = new Map<string, DealerAgg>();
    for (const p of frozenPayments) {
      const dealerId = p.delivery.customerId;
      const agg = aggByDealer.get(dealerId) ?? {
        outstandingCents: 0,
        unpaidDeliveryCount: 0,
        failedPaymentCount: 0,
        lastFailureAt: null,
        lastFailureCode: null,
        maxAttemptCount: 0,
      };
      agg.outstandingCents += Math.round(Number(p.amount) * 100);
      agg.unpaidDeliveryCount += 1;
      if (p.status === EnumPaymentStatus.CHARGE_FAILED) {
        agg.failedPaymentCount += 1;
        const failedAt = p.failedAt ? new Date(p.failedAt) : null;
        if (failedAt && (!agg.lastFailureAt || failedAt > agg.lastFailureAt)) {
          agg.lastFailureAt = failedAt;
          agg.lastFailureCode = p.failureCode;
        }
        const attempt = p.attemptCount ?? 0;
        if (attempt > agg.maxAttemptCount) agg.maxAttemptCount = attempt;
      }
      aggByDealer.set(dealerId, agg);
    }

    const frozenDealers = frozen.map((d) => {
      const agg = aggByDealer.get(d.id);
      const outstandingCents = agg?.outstandingCents ?? 0;
      return {
        dealerId: d.id,
        businessName: d.businessName,
        contactEmail: d.user?.email ?? null,
        billingFrozenAt: d.billingFrozenAt?.toISOString() ?? null,
        billingFrozenReason: d.billingFrozenReason,
        hasSavedCard: Boolean(d.stripeDefaultPaymentMethodId),
        hasSubscription: Boolean(d.stripeSubscriptionId),
        capCents: d.postpaidCreditLimitCents,
        outstandingCents,
        outstandingDollars: Number((outstandingCents / 100).toFixed(2)),
        unpaidDeliveryCount: agg?.unpaidDeliveryCount ?? 0,
        failedPaymentCount: agg?.failedPaymentCount ?? 0,
        lastFailureAt: agg?.lastFailureAt?.toISOString() ?? null,
        lastFailureCode: agg?.lastFailureCode ?? null,
        maxAttemptCount: agg?.maxAttemptCount ?? null,
      };
    });

    // ── 3. Warning dealers — failed charges exist but the graduated
    //      policy hasn't frozen them yet (attempt 1-2). Ordered by most
    //      recent failure so the freshest problems surface first. ──
    const warningPayments = await this.prisma.payment.findMany({
      where: {
        paymentType: EnumPaymentPaymentType.POSTPAID,
        status: EnumPaymentStatus.CHARGE_FAILED,
        delivery: { customer: { billingFrozen: false } },
      },
      select: {
        amount: true,
        failureCode: true,
        failedAt: true,
        attemptCount: true,
        delivery: {
          select: {
            customer: {
              select: {
                id: true,
                businessName: true,
                stripeDefaultPaymentMethodId: true,
                stripeSubscriptionId: true,
                postpaidCreditLimitCents: true,
                user: { select: { email: true } },
              },
            },
          },
        },
      },
      orderBy: { failedAt: "desc" },
      take: 300,
    });

    interface WarningAgg {
      customer: (typeof warningPayments)[number]["delivery"]["customer"];
      failedPaymentCount: number;
      failedAmountCents: number;
      lastFailureAt: Date | null;
      lastFailureCode: string | null;
      maxAttemptCount: number;
    }
    const warningByDealer = new Map<string, WarningAgg>();
    for (const p of warningPayments) {
      const customer = p.delivery.customer;
      if (!customer) continue;
      const agg = warningByDealer.get(customer.id) ?? {
        customer,
        failedPaymentCount: 0,
        failedAmountCents: 0,
        lastFailureAt: null,
        lastFailureCode: null,
        maxAttemptCount: 0,
      };
      agg.failedPaymentCount += 1;
      agg.failedAmountCents += Math.round(Number(p.amount) * 100);
      const failedAt = p.failedAt ? new Date(p.failedAt) : null;
      if (failedAt && (!agg.lastFailureAt || failedAt > agg.lastFailureAt)) {
        agg.lastFailureAt = failedAt;
        agg.lastFailureCode = p.failureCode;
      }
      const attempt = p.attemptCount ?? 0;
      if (attempt > agg.maxAttemptCount) agg.maxAttemptCount = attempt;
      warningByDealer.set(customer.id, agg);
    }

    const warningDealers = Array.from(warningByDealer.values())
      .slice(0, 50)
      .map((agg) => ({
        dealerId: agg.customer.id,
        businessName: agg.customer.businessName,
        contactEmail: agg.customer.user?.email ?? null,
        hasSavedCard: Boolean(agg.customer.stripeDefaultPaymentMethodId),
        hasSubscription: Boolean(agg.customer.stripeSubscriptionId),
        capCents: agg.customer.postpaidCreditLimitCents,
        failedPaymentCount: agg.failedPaymentCount,
        failedAmountDollars: Number((agg.failedAmountCents / 100).toFixed(2)),
        lastFailureAt: agg.lastFailureAt?.toISOString() ?? null,
        lastFailureCode: agg.lastFailureCode,
        maxAttemptCount: agg.maxAttemptCount ?? null,
      }));

    // ── 4. Uncollectible remainders — written off after the 7-day retry
    //      window; only an admin can recover these now. ──
    const uncollectible = await this.prisma.payment.findMany({
      where: { remainderChargeStatus: "UNCOLLECTIBLE" },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        deliveryId: true,
        delivery: {
          select: {
            customerId: true,
            customer: { select: { businessName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const uncollectiblePayments = uncollectible.map((p) => ({
      paymentId: p.id,
      deliveryId: p.deliveryId,
      dealerId: p.delivery.customerId,
      businessName: p.delivery.customer?.businessName ?? null,
      amount: p.amount,
      amountDollars: Number((Number(p.amount)).toFixed(2)),
      writtenOffAt: p.createdAt.toISOString(),
    }));

    const frozenOutstandingCents = frozenDealers.reduce(
      (sum, d) => sum + d.outstandingCents,
      0,
    );

    // ── D1/D2: nightly reconciliation findings (unresolved) — CRITICAL
    // first, then WARNING, then AUTO_REPAIRED history, newest within group.
    const [openFindings, openFindingCount] = await Promise.all([
      this.prisma.billingAuditFinding.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { customer: { select: { businessName: true } } },
      }),
      this.prisma.billingAuditFinding.count({ where: { resolvedAt: null } }),
    ]);
    const severityRank: Record<string, number> = {
      CRITICAL: 0,
      WARNING: 1,
      AUTO_REPAIRED: 2,
    };
    const reconciliationFindings = openFindings
      .map((f) => ({
        id: f.id,
        customerId: f.customerId,
        businessName: f.customer?.businessName ?? null,
        check: f.check,
        severity: f.severity,
        detail: f.detail,
        expectedValue: f.expectedValue,
        actualValue: f.actualValue,
        repairedAt: f.repairedAt?.toISOString() ?? null,
        createdAt: f.createdAt.toISOString(),
      }))
      .sort(
        (a, b) =>
          (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3),
      );

    return {
      frozenDealers,
      warningDealers,
      uncollectiblePayments,
      reconciliationFindings,
      totals: {
        frozenCount: frozenDealers.length,
        warningCount: warningDealers.length,
        uncollectibleCount: uncollectiblePayments.length,
        frozenOutstandingCents,
        frozenOutstandingDollars: Number(
          (frozenOutstandingCents / 100).toFixed(2),
        ),
        reconciliationOpenCount: openFindingCount,
      },
    };
  }

  /**
   * D2 — admin one-click repair: re-set the Stripe customer's
   * invoice_settings.default_payment_method from our DB record.
   *
   * Used for the DEFAULT_PM_DRIFT finding (DB says a card, Stripe says
   * none — the exact Farragut failure). Performs the same safety check the
   * nightly auto-repair does: the card must still be attached to the
   * dealer's Stripe customer, otherwise no write happens and the admin is
   * told to have the dealer re-save their card instead.
   *
   * Returns a human-readable outcome for the admin UI toast.
   */
  async repairStripeDefaultFromDb(dealerId: string): Promise<{ repaired: boolean; message: string }> {
    if (!this.stripeService) {
      throw new Error("StripeService unavailable");
    }

    const dealer = await this.prisma.customer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        businessName: true,
        stripeCustomerId: true,
        stripeDefaultPaymentMethodId: true,
      },
    });
    if (!dealer?.stripeCustomerId) {
      throw new BadRequestException("Dealer has no Stripe customer");
    }
    if (!dealer.stripeDefaultPaymentMethodId) {
      throw new BadRequestException(
        "No card in our DB to repair from — ask the dealer to save a card in the app.",
      );
    }

    // Safety: the card must be attached to THIS customer. A PM attached to
    // another customer (or detached entirely) can never be a valid default.
    let attachedCustomer: string | null = null;
    try {
      const pm: any = await this.stripeService.stripe.paymentMethods.retrieve(
        dealer.stripeDefaultPaymentMethodId,
      );
      attachedCustomer =
        typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? null;
    } catch {
      attachedCustomer = null;
    }
    if (attachedCustomer !== dealer.stripeCustomerId) {
      throw new BadRequestException(
        `Card ${dealer.stripeDefaultPaymentMethodId} is not attached to this dealer's Stripe customer (${attachedCustomer ?? "detached"}). The dealer must re-save their card in the app.`,
      );
    }

    await this.stripeService.stripe.customers.update(dealer.stripeCustomerId, {
      invoice_settings: { default_payment_method: dealer.stripeDefaultPaymentMethodId },
    });
    this.logger.log(
      `Admin repair: Stripe default_payment_method re-set to ${dealer.stripeDefaultPaymentMethodId} for dealer ${dealerId} (${dealer.businessName ?? "?"})`,
    );

    // Close the open drift findings — the repair is verified-by-construction
    // (same write + safety check the nightly job makes), and the next audit
    // run confirms anyway.
    await this.prisma.billingAuditFinding.updateMany({
      where: {
        customerId: dealerId,
        check: { in: ["DEFAULT_PM_DRIFT", "PM_NOT_ATTACHED"] },
        resolvedAt: null,
      },
      data: { resolvedAt: new Date() },
    });

    return {
      repaired: true,
      message: "Stripe default card re-set from our records. Open invoices will charge it on the next retry.",
    };
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
    // ── Final next-charge number ("show the final deduction, not
    // partial") ──
    // Stripe's official upcoming-invoice amount_due: $0 anchor + every
    // pending delivery-fee InvoiceItem ± credits already applied to this
    // cycle. Null when there is no subscription or no upcoming invoice.
    upcomingInvoiceAmountCents: number | null;
    // Sum of the dealer's PENDING referral credits (not yet applied to
    // any invoice) — the UI shows "Includes −$X referral credits".
    pendingReferralCreditCents: number;
    // THE number to display: upcomingInvoiceAmountCents minus the
    // referral credits that WILL be applied at invoice.upcoming,
    // computed with the exact same oldest-first whole-credit FIFO rule
    // ReferralCreditApplicationService.applyPostpaidCreditsToUpcomingInvoice
    // uses. Matches the final invoice total 1:1.
    estimatedNextChargeCents: number | null;
    // ── Next-charge breakdown (the clickable "how we got to this amount"
    // detail view) ──
    // Lines the next charge is built from. source="stripe" when built
    // from Stripe's official upcoming-invoice preview (the anchor plan
    // line + every pending delivery InvoiceItem ± credit lines), "db"
    // when estimated from local unpaid rows (no preview available).
    nextChargeLines: Array<{
      id: string;
      source: "stripe" | "db";
      description: string;
      amountCents: number;
      date: string | null;
      deliveryId: string | null;
      pickupAddress: string | null;
      dropoffAddress: string | null;
      completedAt: string | null;
    }>;
    // Unpaid local rows that are NOT on Stripe's upcoming preview. Healthy
    // state: empty. Non-empty = DB↔Stripe drift — e.g. the item was already
    // swept into a past invoice whose payment_succeeded webhook was missed
    // (the nightly stuck-usage reconciliation heals these to PAID), or
    // usage hasn't been reported yet. Surfaced so the dealer is never
    // confused by a delivery count that doesn't match the invoice.
    unreconciledLines: Array<{
      id: string;
      description: string;
      amountCents: number;
      date: string | null;
      deliveryId: string;
      pickupAddress: string;
      dropoffAddress: string;
    }>;
    // The portion of pendingReferralCreditCents that will actually be
    // applied to THIS next charge under the FIFO rule — may be less than
    // the pending sum when credits exceed what the invoice needs.
    creditsApplyingCents: number;
    // Per-payment failure details — so the dealer dashboard can show
    // "Your charge of $X failed because [reason]. Stripe will retry
    // on [date]." with an "Update payment method" button.
    failedPayments: Array<{
      paymentId: string;
      amount: number;
      failureCode: string | null;
      failureMessage: string | null;
      failedAt: Date | null;
      // Which retry attempt this was (1 = initial charge, 2 = first
      // retry, ...) — from Stripe's invoice attempt_count. Drives the
      // dealer-facing "failed 1st / 2nd / 3rd consecutive time"
      // progression in the postpaid panel.
      attemptCount: number | null;
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

    // Unpaid postpaid deliveries — the count for the panel PLUS the rows
    // themselves, which feed the next-charge breakdown detail view.
    const unpaidRows = await this.prisma.payment.findMany({
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
      select: {
        id: true,
        amount: true,
        status: true,
        stripeInvoiceItemId: true,
        delivery: {
          select: { id: true, pickupAddress: true, dropoffAddress: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    const unpaidCount = unpaidRows.length;

    // Completion dates for the breakdown (DeliveryRequest has no
    // completedAt column — the COMPLETED status-history row is the source
    // of truth). One query for all unpaid deliveries.
    const unpaidDeliveryIds = unpaidRows.map((r) => r.delivery.id);
    const completionHistory = unpaidDeliveryIds.length
      ? await this.prisma.deliveryStatusHistory.findMany({
          where: {
            deliveryId: { in: unpaidDeliveryIds },
            toStatus: EnumDeliveryRequestStatus.COMPLETED,
          },
          select: { deliveryId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [];
    const completionDates = new Map(
      completionHistory.map((h) => [h.deliveryId, h.createdAt]),
    );

    // Look up the next upcoming invoice from Stripe (best-effort —
    // returns null if Stripe is unconfigured or no open invoice exists).
    // Stripe SDK v22 renamed `retrieveUpcoming` to `createPreview` —
    // same behavior, new name.
    let nextInvoiceDate: Date | null = null;
    let upcomingInvoiceAmountCents: number | null = null;
    let estimatedNextChargeCents: number | null = null;
    let creditsApplyingCents = 0;
    // Breakdown lines from Stripe's official preview (hasPreview=true) or
    // estimated from local rows (hasPreview=false).
    let stripeLines: Array<{
      id: string;
      source: "stripe" | "db";
      description: string;
      amountCents: number;
      date: string | null;
      deliveryId: string | null;
      pickupAddress: string | null;
      dropoffAddress: string | null;
      completedAt: string | null;
    }> = [];
    let hasPreview = false;
    // InvoiceItem ids found on Stripe's preview lines — used to detect
    // unpaid local rows that are NOT on the upcoming invoice (drift).
    let previewItemIdsSet = new Set<string>();

    // Pending referral credits — subtracted below so the panel shows the
    // FINAL deduction, not a partial number. They are only applied to the
    // real invoice ~1h before finalization (handleInvoiceUpcoming →
    // ReferralCreditApplicationService), so until then Stripe's preview
    // alone overstates the charge by exactly the pending-credit amount.
    const pendingCredits = await this.prisma.referralCredit.findMany({
      where: { customerId: dealerId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { amountCents: true },
    });
    const pendingReferralCreditCents = pendingCredits.reduce(
      (sum, c) => sum + c.amountCents,
      0,
    );

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

        // ── The final number the dealer will see deducted ──
        // amount_due already includes every pending delivery-fee
        // InvoiceItem swept into this cycle. Subtract the dealer's
        // PENDING referral credits using the EXACT same oldest-first
        // whole-credit FIFO rule the applier uses at invoice.upcoming
        // (credits that don't fit the invoice total stay PENDING for the
        // next invoice) so the panel number matches the final invoice 1:1.
        const amountDueCents = upcoming.amount_due ?? 0;
        upcomingInvoiceAmountCents = amountDueCents;
        hasPreview = true;
        const budgetCents =
          amountDueCents > 0 ? amountDueCents : Number.MAX_SAFE_INTEGER;
        let applicableCreditCents = 0;
        for (const credit of pendingCredits) {
          if (applicableCreditCents + credit.amountCents > budgetCents) {
            continue;
          }
          applicableCreditCents += credit.amountCents;
        }
        creditsApplyingCents = applicableCreditCents;
        estimatedNextChargeCents = Math.max(
          0,
          amountDueCents - applicableCreditCents,
        );

        // ── Build the breakdown lines from Stripe's official preview ──
        // Every line the invoice will charge: the anchor plan line,
        // every pending delivery InvoiceItem, and any negative credit
        // lines Stripe already holds. InvoiceItem lines are matched back
        // to their Payment row so the dealer sees pickup → dropoff and
        // the completed date, not opaque Stripe ids.
        const previewItemIds = new Set(this.extractInvoiceItemIds(upcoming));
        previewItemIdsSet = previewItemIds;
        const rowsByItemId = new Map(
          unpaidRows
            .filter((r) => r.stripeInvoiceItemId && previewItemIds.has(r.stripeInvoiceItemId))
            .map((r) => [r.stripeInvoiceItemId as string, r]),
        );
        const rawPreviewLines: any[] = (upcoming as any).lines?.data ?? [];
        stripeLines = rawPreviewLines.slice(0, 50).map((l) => {
          const itemId = this.extractOneLineItemId(l);
          const row = itemId ? rowsByItemId.get(itemId) : undefined;
          const periodEnd = l?.period?.end;
          return {
            id: itemId ?? String(l.id),
            source: "stripe" as const,
            description: l.description || "Weekly plan",
            amountCents: l.amount ?? 0,
            date: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            deliveryId: row?.delivery?.id ?? null,
            pickupAddress: row?.delivery?.pickupAddress ?? null,
            dropoffAddress: row?.delivery?.dropoffAddress ?? null,
            completedAt: row
              ? (completionDates.get(row.delivery.id)?.toISOString() ?? null)
              : null,
          };
        });
      } catch (err: any) {
        // Likely "no upcoming invoice" — log + continue.
        this.logger.debug(
          `getMyStatus: no upcoming invoice for dealer ${dealerId} (${err?.message})`,
        );
      }
    }

    // ── Fallback: no Stripe preview available ──
    // (No subscription yet, or Stripe returned no upcoming invoice.)
    // Never leave the dealer staring at a blank dash while they owe
    // money — estimate the next deduction from the unpaid completed
    // deliveries minus the credits that will ride the next invoice
    // (same FIFO rule as above). Once the weekly subscription preview
    // becomes available, this estimate is replaced by Stripe's exact
    // amount_due. upcomingInvoiceAmountCents stays null so the frontend
    // can label the figure as an estimate rather than Stripe-official.
    if (upcomingInvoiceAmountCents === null) {
      const fallbackBudgetCents =
        outstandingCents > 0 ? outstandingCents : Number.MAX_SAFE_INTEGER;
      let fallbackCreditCents = 0;
      for (const credit of pendingCredits) {
        if (fallbackCreditCents + credit.amountCents > fallbackBudgetCents) {
          continue;
        }
        fallbackCreditCents += credit.amountCents;
      }
      creditsApplyingCents = fallbackCreditCents;
      estimatedNextChargeCents = Math.max(
        0,
        outstandingCents - fallbackCreditCents,
      );
    }

    // ── Assemble the breakdown for the detail view ──
    // With a preview: Stripe's lines are the truth of what will charge;
    // any unpaid LOCAL row whose InvoiceItem is not on the preview goes
    // into unreconciledLines (drift — healed by the nightly stuck-usage
    // reconciliation). Without a preview: estimate lines from local rows.
    const dbEstimateLines = unpaidRows.map((r) => ({
      id: r.id,
      source: "db" as const,
      description: `Delivery · ${r.delivery.pickupAddress} → ${r.delivery.dropoffAddress}`,
      amountCents: Math.round(Number(r.amount) * 100),
      date: completionDates.get(r.delivery.id)?.toISOString() ?? null,
      deliveryId: r.delivery.id,
      pickupAddress: r.delivery.pickupAddress,
      dropoffAddress: r.delivery.dropoffAddress,
      completedAt: completionDates.get(r.delivery.id)?.toISOString() ?? null,
    }));
    const nextChargeLines = hasPreview ? stripeLines : dbEstimateLines;
    const unreconciledLines = hasPreview
      ? unpaidRows
          .filter(
            (r) =>
              !r.stripeInvoiceItemId ||
              !previewItemIdsSet.has(r.stripeInvoiceItemId),
          )
          .map((r) => ({
            id: r.id,
            description: `${r.delivery.pickupAddress} → ${r.delivery.dropoffAddress}`,
            amountCents: Math.round(Number(r.amount) * 100),
            date: completionDates.get(r.delivery.id)?.toISOString() ?? null,
            deliveryId: r.delivery.id,
            pickupAddress: r.delivery.pickupAddress,
            dropoffAddress: r.delivery.dropoffAddress,
          }))
      : [];

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
        attemptCount: true,
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
      upcomingInvoiceAmountCents,
      pendingReferralCreditCents,
      estimatedNextChargeCents,
      nextChargeLines,
      unreconciledLines,
      creditsApplyingCents,
      failedPayments: failedPayments.map((p) => ({
        paymentId: p.id,
        amount: p.amount,
        failureCode: p.failureCode,
        failureMessage: p.failureMessage,
        failedAt: p.failedAt,
        attemptCount: p.attemptCount,
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
        // ── Fix #8: retry ALL open invoices, not just the most recent.
        // The old `retryFailedCharge` only retried the most recent open
        // invoice — if a dealer had 3 weeks of failed invoices, only the
        // most recent was retried. Older ones were left to be auto-marked
        // uncollectible by Stripe after 30 days. This meant money for
        // older weeks was effectively written off.
        //
        // `retryAllFailedCharges` lists all open invoices via
        // `stripe.invoices.list({ subscription, status: 'open' })` and
        // retries each one (with a small delay to avoid rate limits).
        const result = await this.retryAllFailedCharges(dealer.id);
        if (result.skippedNoCard && result.skippedNoCard > 0) {
          this.logger.log(
            `autoRetryFrozenDealers: dealer ${dealer.id} — skipped ${result.skippedNoCard} invoice(s): no default card on the Stripe customer (NO_SAVED_CARD)`,
          );
        } else {
          this.logger.log(
            `autoRetryFrozenDealers: dealer ${dealer.id} — ` +
            `${result.succeeded}/${result.invoicesRetried} invoice(s) succeeded`,
          );
        }
      } catch (err: any) {
        // Don't let one dealer's failure abort the rest.
        this.logger.warn(
          `autoRetryFrozenDealers: retry for dealer ${dealer.id} failed: ${err?.message}`,
        );
      }
    }
  }

  // ─── MISSING USAGE REPORT BACKFILL ──────────────────────────────

  /**
   * Where-clause for "stranded" postpaid payments — rows that SHOULD
   * have been reported to Stripe but never were:
   *
   *   • paymentType = POSTPAID
   *   • status AUTHORIZED (set at delivery creation) or INVOICED (legacy)
   *   • no stripeInvoiceItemId → usage was never reported (that field is
   *     the idempotency key for reporting)
   *   • delivery COMPLETED → the service was actually rendered
   *   • dealer CURRENTLY on WEEKLY_POSTPAID with a Stripe customer →
   *     reporting them now would actually bill someone
   *
   * How rows get stranded here: reportUsageToStripe() only runs at
   * delivery completion, and its billingMode guard SKIPS silently (no
   * retry scheduled) when the dealer wasn't fully onboarded at that
   * moment. The hourly retry cron only picks up rows with
   * usageReportStatus = FAILED, which silent skips never set — so these
   * rows stay in AUTHORIZED forever, freezing the dealer's outstanding
   * balance at a constant number (prod example: 46 rows / $11,328.16
   * unchanged since March).
   */
  private missingUsageReportWhere(dealerId?: string): Prisma.PaymentWhereInput {
    return {
      paymentType: EnumPaymentPaymentType.POSTPAID,
      // Either stuck pre-report (AUTHORIZED / legacy INVOICED) OR the
      // reporting pipeline gave up (PERMANENTLY_FAILED after 5 backoff
      // retries — e.g. a long Stripe outage at completion time). Both
      // mean the same thing: a COMPLETED delivery whose usage never
      // reached Stripe.
      OR: [
        {
          status: {
            in: [EnumPaymentStatus.AUTHORIZED, EnumPaymentStatus.INVOICED],
          },
        },
        { usageReportStatus: "PERMANENTLY_FAILED" },
      ],
      stripeInvoiceItemId: null,
      delivery: {
        status: EnumDeliveryRequestStatus.COMPLETED,
        customer: {
          billingMode: EnumCustomerBillingMode.WEEKLY_POSTPAID,
          stripeCustomerId: { not: null },
          ...(dealerId ? { id: dealerId } : {}),
        },
      },
    };
  }

  /**
   * Count + sum the stranded rows — surfaced on the admin status and
   * /admin/health endpoints so the backlog is visible, and used by the
   * admin PostpaidBillingCard to offer the one-click heal.
   */
  async getMissingUsageReportStats(
    dealerId?: string,
  ): Promise<{ count: number; totalCents: number }> {
    const rows = await this.prisma.payment.findMany({
      where: this.missingUsageReportWhere(dealerId),
      select: { amount: true },
    });
    return {
      count: rows.length,
      totalCents: rows.reduce(
        (sum, p) => sum + Math.round(Number(p.amount) * 100),
        0,
      ),
    };
  }

  /**
   * Heal the stranded rows: re-run reportUsageToStripe() for each one.
   *
   * reportUsageToStripe is idempotent (skips if stripeInvoiceItemId is
   * already set), re-validates postpaid/billingMode, and on success
   * moves the row to USAGE_REPORTED — putting it back into the normal
   * lifecycle (next weekly invoice → PAID, or CHARGE_FAILED with the
   * dealer-facing failure banners when the charge fails).
   *
   * Rows whose reporting fails here are scheduled into the hourly retry
   * queue by reportUsageToStripe itself (exponential backoff, then
   * PERMANENTLY_FAILED for admin attention via /admin/health).
   *
   * Batch-capped per run so a large backlog can't blow through the
   * Stripe rate limit; the daily cron drains the remainder over time.
   *
   * Called by the daily @Cron (03:00) and the admin endpoint
   * POST /dealers/:dealerId/backfill-usage.
   */
  async backfillMissingUsageReports(input?: {
    dealerId?: string;
    limit?: number;
  }): Promise<{ found: number; processed: number; succeeded: number; failed: number }> {
    if (!this.stripeService) {
      // No Stripe configured — nothing we can report to. Rows stay
      // stranded (and counted) until Stripe is available.
      return { found: 0, processed: 0, succeeded: 0, failed: 0 };
    }

    const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
    const where = this.missingUsageReportWhere(input?.dealerId);

    const found = await this.prisma.payment.count({ where });
    if (found === 0) {
      return { found: 0, processed: 0, succeeded: 0, failed: 0 };
    }

    const batch = await this.prisma.payment.findMany({
      where,
      select: { id: true, deliveryId: true },
      orderBy: { createdAt: "asc" }, // oldest debt first
      take: limit,
    });

    this.logger.log(
      `backfillMissingUsageReports: ${found} stranded postpaid payment(s)` +
        `${input?.dealerId ? ` for dealer ${input.dealerId}` : ""} — processing ${batch.length}`,
    );

    let succeeded = 0;
    let failed = 0;

    for (const item of batch) {
      try {
        const result = await this.reportUsageToStripe({ deliveryId: item.deliveryId });
        if (result.stripeInvoiceItemId) {
          succeeded++;
        } else {
          // reportUsageToStripe already scheduled a retry
          // (usageReportStatus=FAILED → hourly retry queue picks it up).
          failed++;
        }
      } catch (err: any) {
        // reportUsageToStripe is non-throwing by design — safety net.
        this.logger.error(
          `backfillMissingUsageReports threw for delivery ${item.deliveryId}: ${err?.message}`,
          err?.stack,
        );
        await this.scheduleUsageReportRetry(item.id, `Backfill threw: ${err?.message}`);
        failed++;
      }
    }

    this.logger.log(
      `backfillMissingUsageReports: ${succeeded} reported, ${failed} failed ` +
        `of ${batch.length} processed (${found - batch.length} remaining for the next run)`,
    );

    return { found, processed: batch.length, succeeded, failed };
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
   * Extract the InvoiceItem ids referenced by an invoice (or preview)'s
   * line items — across Stripe API schema generations.
   *
   *   Pre-2025 (legacy):    line.invoiceitem
   *   basil/dahlia (2025+): line.parent.invoice_item_details.invoice_item
   *
   * Our pinned API version is 2026-04-22.dahlia, where ONLY the parent
   * form exists. The old `.map(l => l.invoiceitem)` returned [] for every
   * invoice — which made payment_succeeded a silent no-op (it looked like
   * a $0 anchor invoice) and left payment_failed matching nothing on the
   * first attempt. Also used by BillingReconciliationService's backfill.
   */
  extractInvoiceItemIds(invoice: any): string[] {
    const lines: any[] = invoice?.lines?.data ?? [];
    const ids: string[] = [];
    for (const l of lines) {
      const id = this.extractOneLineItemId(l);
      if (id) ids.push(id);
    }
    return ids;
  }

  extractOneLineItemId(line: any): string | null {
    if (!line) return null;
    return (
      line.parent?.invoice_item_details?.invoice_item ?? // dahlia/basil+
      line.invoiceitem ?? // legacy flat field (pre-2025 API versions)
      line.invoice_item ?? // legacy snake_case alias
      null
    );
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

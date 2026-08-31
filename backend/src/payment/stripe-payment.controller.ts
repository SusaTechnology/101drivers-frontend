import { Controller, Get, Post, Param, Body, Req, Query, Logger, UseGuards, NotFoundException, BadRequestException } from "@nestjs/common";
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
        // Stable idempotency key — a retry uses the same key → no double charge.
        idempotencyKey: `pi-manual-${deliveryId}`,
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
      throw new BadRequestException("Invalid delivery ID or tip amount");
    }

    if (amount > 500) {
      throw new BadRequestException("Tip amount cannot exceed $500");
    }

    // Verify delivery exists and is completed
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
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

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.status !== "COMPLETED") {
      throw new BadRequestException("Tips can only be added to completed deliveries");
    }

    // ── Pre-check: dealer MUST have a saved card ──
    // Without this, Stripe returns a PI in `requires_payment_method`
    // state, and the frontend would render a card-entry dialog (the
    // bug we're fixing). Tips should be one-click — the dealer has
    // already saved a card for delivery creation; use it for tips too.
    //
    // If the dealer wants to use a different card, they should change
    // their default in Payment Methods first. This matches the
    // delivery-creation flow (which also uses the saved card with no
    // dialog).
    if (!delivery.customer?.stripeCustomerId) {
      throw new BadRequestException(
        "No payment method on file. Please save a card under Payment Methods first, then try again.",
      );
    }
    if (!delivery.customer?.stripeDefaultPaymentMethodId) {
      throw new BadRequestException(
        "No saved payment method on file. Please save a card under Payment Methods first, then try again.",
      );
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
      // ── Use the dealer's saved card + auto-confirm ──
      // Before this fix, the PI was created without a payment method,
      // so Stripe returned `requires_payment_method` and the frontend
      // rendered a card-entry dialog. The dealer had to re-enter their
      // card even though they had a saved one. With `confirm: true`,
      // Stripe charges the saved card immediately. No dialog needed.
      //
      // If the customer's bank requires 3DS, Stripe returns
      // `requires_action` and the frontend renders a 3DS confirmation
      // modal (when it's implemented). Until then, the tip fails with
      // a clear error.
      //
      // If the saved card is declined, Stripe throws and we surface
      // a friendly error to the dealer.
      const result = await this.stripeService.createPaymentIntent({
        amount,
        deliveryId,
        metadata: { type: "tip" },
        captureMethod: 'automatic', // Tips charge immediately (post-completion)
        stripeCustomerId: delivery.customer!.stripeCustomerId!,
        paymentMethodId: delivery.customer!.stripeDefaultPaymentMethodId!,
        confirm: true, // ── auto-confirm with the saved card ──
        // Stable idempotency key — includes the tip amount so that
        // changing the tip amount creates a new PI (different key),
        // but retrying the same tip amount uses the same key → no double charge.
        idempotencyKey: `pi-tip-${deliveryId}-${amount}`,
      });

      // Re-fetch the PI to learn its true status after confirmation.
      // `createPaymentIntent` returns the initial status, but with
      // `confirm: true` Stripe may have already moved it to
      // `succeeded` or `requires_action`.
      const refreshedPi = await this.stripeService.getPaymentIntent(result.paymentIntentId);
      const finalStatus = refreshedPi.status;

      // Upsert tip record — capture the tip row id so the frontend can PATCH
      // the same row by id after the Stripe payment confirms. Without this,
      // the frontend's `existingTip` (fetched on page load, before the tip
      // was created) is undefined and the PATCH hits /api/tips/undefined → 404.
      let tipId: string;
      const tipStatus =
        finalStatus === "succeeded" ? "CAPTURED" :
        finalStatus === "requires_action" ? "AUTHORIZED" :
        finalStatus === "requires_capture" ? "AUTHORIZED" :
        "AUTHORIZED";
      if (existingTip) {
        const updated = await this.prisma.tip.update({
          where: { deliveryId },
          data: {
            amount,
            provider: "STRIPE",
            providerRef: result.paymentIntentId,
            status: tipStatus as any,
          },
          select: { id: true },
        });
        tipId = updated.id;
      } else {
        const created = await this.prisma.tip.create({
          data: {
            amount,
            deliveryId,
            provider: "STRIPE",
            providerRef: result.paymentIntentId,
            status: tipStatus as any,
          },
          select: { id: true },
        });
        tipId = created.id;
      }

      // Return the final status so the frontend knows whether to show
      // "Tip Sent!" directly (succeeded) or render the 3DS modal
      // (requires_action). For `requires_payment_method` or other
      // failure states, we throw below.
      if (finalStatus === "succeeded") {
        return {
          tipId,
          paymentIntentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          status: "succeeded",
          amount,
        };
      }
      if (finalStatus === "requires_action") {
        // 3DS required — frontend should render the 3DS modal (when
        // implemented). For now, this is a hard failure on the frontend
        // side (the TipPaymentForm will detect this status and show
        // a "your bank requires 3DS, please try a different card"
        // message).
        return {
          tipId,
          paymentIntentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          status: "requires_action",
          amount,
        };
      }
      // Other statuses (requires_payment_method, canceled, etc.) —
      // the charge didn't go through. Throw a friendly error.
      throw new BadRequestException(
        `Tip payment could not be completed (Stripe status: ${finalStatus}). ` +
          "Please try a different card or contact support.",
      );
    } catch (err: any) {
      this.logger.error(`Tip PaymentIntent creation failed: ${err.message}`);
      // Re-throw BadRequestException so the dealer sees the friendly
      // message. Don't wrap — the original message is already
      // dealer-readable.
      if (err instanceof BadRequestException) throw err;
      // Translate Stripe errors to friendly messages
      const friendly = this.translateStripeCardError(
        err,
        "We could not process your tip at this time. Please try again or contact support.",
      );
      throw new BadRequestException(friendly);
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
    @Body() body?: { note?: string; amount?: number },
  ) {
    // 1. Fetch the payment record
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // 2. Validate status — only CAPTURED or PAID can be refunded
    if (!['CAPTURED', 'PAID', 'REFUNDED'].includes(payment.status)) {
      throw new BadRequestException(
        `Cannot refund payment in ${payment.status} status. Only CAPTURED, PAID, or partially-REFUNDED payments can be refunded.`,
      );
    }

    if (!payment.providerPaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe PaymentIntent reference.');
    }

    // ── Pre-check: is this charge already fully refunded? ──
    // If the payment is already REFUNDED with refundStatus = FULL,
    // reject immediately — don't even call Stripe. This prevents
    // the "Charge has already been refunded" error from Stripe
    // when the admin double-clicks or retries a full refund.
    if (payment.status === 'REFUNDED' && (payment as any).refundStatus === 'FULL') {
      throw new BadRequestException(
        'This payment has already been fully refunded. No further refunds are possible.',
      );
    }

    // 3. Validate partial refund amount if specified
    const isPartial = body?.amount !== undefined && body.amount > 0;
    if (isPartial) {
      const alreadyRefundedCents = payment.refundedAmountCents ?? 0;
      const totalCents = Math.round(Number(payment.amount) * 100);
      const requestedCents = Math.round(body!.amount! * 100);
      const remainingCents = totalCents - alreadyRefundedCents;

      if (requestedCents > remainingCents) {
        throw new BadRequestException(
          `Cannot refund $${body!.amount!.toFixed(2)} — only $${(remainingCents / 100).toFixed(2)} ` +
          `remaining (total $${(totalCents / 100).toFixed(2)}, already refunded $${(alreadyRefundedCents / 100).toFixed(2)}).`,
        );
      }
    } else {
      // Full refund — check if the charge is already partially refunded.
      // If it is, a full refund would refund the remaining balance (which
      // Stripe handles automatically). But if the charge is ALREADY
      // fully refunded, we already caught that above. If it's partially
      // refunded, the "full refund" button should refund the remaining
      // balance — which is correct. No extra check needed here.
    }

    try {
      // 4. Retrieve the PaymentIntent to get the latest charge
      const pi = await this.stripeService.getPaymentIntent(payment.providerPaymentIntentId);

      // PaymentIntent must have a charge to refund
      const charge = pi.latest_charge;
      if (!charge) {
        throw new BadRequestException(
          'No charge found on this PaymentIntent. Nothing to refund.',
        );
      }

      // 5. Issue refund via Stripe (full or partial)
      const refund = await this.stripeService.createRefund({
        chargeId: typeof charge === 'string' ? charge : (charge as any).id,
        reason: 'requested_by_customer',
        amount: isPartial ? body!.amount : undefined, // omit = full refund
        metadata: {
          paymentId,
          deliveryId: payment.deliveryId,
          adminNote: body?.note || (isPartial ? 'Partial refund processed by admin' : 'Full refund processed by admin'),
        },
      });

      this.logger.log(
        `Refund created: ${refund.id} for charge ${charge} on payment ${paymentId} ` +
        `(${isPartial ? `partial $${body!.amount!.toFixed(2)}` : 'full'})`,
      );

      // NOTE: We do NOT update the payment status here. The
      // `charge.refunded` webhook will fire and update the payment
      // (status, refundedAmountCents, refundStatus, driver clawback).
      // This prevents a race between the API response and the webhook.
      // The webhook handler is the single source of truth for refund state.

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount ? refund.amount / 100 : payment.amount,
        paymentStatus: 'REFUND_PROCESSING',
      };
    } catch (err: any) {
      this.logger.error(`Refund failed for payment ${paymentId}: ${err.message}`);
      // Don't leak Stripe internal errors
      const friendly = this.translateStripeCardError(
        err,
        'We could not process the refund at this time. Please try again or contact support.',
      );
      throw new BadRequestException(friendly);
    }
  }

  // ── Saved Card Management (SetupIntents) ──────────────────────────

  /**
   * Create or retrieve a Stripe Customer + SetupIntent for saving a card.
   * Frontend uses the clientSecret to render Stripe Elements for card collection.
   */
  @Post("stripe/save-card")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async createSetupIntentForCard(@Body() body: { customerId: string; email?: string; name?: string }) {
    const { customerId, email, name } = body;
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, stripeCustomerId: true, contactEmail: true, businessName: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    try {
      // 1. Create or retrieve Stripe Customer
      const stripeCustomer = await this.stripeService.createOrGetCustomer({
        email: email || customer.contactEmail || undefined,
        name: name || customer.businessName || undefined,
        metadata: { customerId: customer.id },
      });

      // 2. Save stripeCustomerId to our Customer record
      if (!customer.stripeCustomerId || customer.stripeCustomerId !== stripeCustomer.id) {
        await this.prisma.customer.update({
          where: { id: customerId },
          data: { stripeCustomerId: stripeCustomer.id },
        });
      }

      // 3. Create SetupIntent
      const result = await this.stripeService.createSetupIntent({
        customerId: stripeCustomer.id,
      });

      return {
        setupIntentId: result.setupIntentId,
        clientSecret: result.clientSecret,
        stripeCustomerId: stripeCustomer.id,
      };
    } catch (err: any) {
      this.logger.error(`SetupIntent creation failed: ${err.message}`);
      // Don't leak Stripe's raw message ("Request req_xxx: ...") to the dealer.
      throw new BadRequestException(
        this.translateStripeCardError(err, 'We could not save your card at this time. Please try again or contact support.'),
      );
    }
  }

  /**
   * List saved payment methods for a customer.
   */
  @Get("stripe/saved-cards/:customerId")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async getSavedCards(@Param("customerId") customerId: string) {
    if (!customerId) {
      throw new BadRequestException("customerId is required");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, stripeCustomerId: true, stripeDefaultPaymentMethodId: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    if (!customer.stripeCustomerId) {
      return { cards: [], defaultPaymentMethodId: null };
    }

    try {
      const methods = await this.stripeService.listPaymentMethods(customer.stripeCustomerId);

      // ── Auto-recover missing default ────────────────────────────────
      // If the DB has no default payment method but Stripe has cards attached,
      // pick the most recent one and persist it as the default. This handles
      // the case where the SetupIntent webhook didn't fire (misconfigured
      // webhook secret, network blip, etc.) — the card was successfully saved
      // to Stripe but our DB never learned which one is the default.
      let effectiveDefault = customer.stripeDefaultPaymentMethodId;
      if (!effectiveDefault && methods.length > 0) {
        effectiveDefault = methods[0].id;
        try {
          await this.prisma.customer.update({
            where: { id: customerId },
            data: { stripeDefaultPaymentMethodId: effectiveDefault },
          });
          this.logger.log(
            `Auto-set default payment method ${effectiveDefault} for customer ${customerId} (was null, recovered from Stripe)`,
          );
        } catch (persistErr: any) {
          this.logger.warn(
            `Failed to persist auto-default ${effectiveDefault} for customer ${customerId}: ${persistErr.message}`,
          );
          // Continue anyway — return the recovered default so the UI shows it.
        }
      }

      const cards = methods.map((m) => ({
        id: m.id,
        brand: (m.card as any)?.brand || "unknown",
        last4: (m.card as any)?.last4 || "****",
        expMonth: (m.card as any)?.exp_month,
        expYear: (m.card as any)?.exp_year,
        isDefault: m.id === effectiveDefault,
      }));

      return {
        cards,
        defaultPaymentMethodId: effectiveDefault,
      };
    } catch (err: any) {
      this.logger.error(`Failed to list payment methods: ${err.message}`);
      return { cards: [], defaultPaymentMethodId: null };
    }
  }

  /**
   * Remove a saved payment method.
   */
  @Post("stripe/remove-card")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async removeSavedCard(@Body() body: { customerId: string; paymentMethodId: string }) {
    const { customerId, paymentMethodId } = body;
    if (!customerId || !paymentMethodId) {
      throw new BadRequestException("customerId and paymentMethodId are required");
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, stripeCustomerId: true, stripeDefaultPaymentMethodId: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    // ── Fix 3: Pre-checks before card removal ──
    // We block card deletion only when it would leave the dealer with
    // no way to pay (only card) or when it would break an in-flight
    // delivery (active delivery using that card).
    //
    // We do NOT block for outstanding postpaid balance or frozen state —
    // a frozen dealer NEEDS to replace their card, and blocking them
    // would prevent the auto-unfreeze flow from working.

    // Check 1: Is this the only card on file?
    // We query Stripe for the list of attached payment methods.
    // This is the authoritative count — our DB only tracks the default,
    // not all cards. If Stripe says there's only 1 (or 0), block.
    //
    // IMPORTANT: We must count ONLY active (non-detached) cards.
    // Stripe's paymentMethods.list returns only attached cards
    // (detached cards don't appear in this list), so the count is
    // accurate.
    let attachedCardCount = 0;
    if (customer.stripeCustomerId) {
      try {
        const attachedCards = await this.stripeService.listPaymentMethods(
          customer.stripeCustomerId,
        );
        attachedCardCount = attachedCards.length;
        this.logger.log(
          `remove-card: customer ${customerId} has ${attachedCardCount} card(s) on Stripe`,
        );
      } catch (stripeErr: any) {
        // Stripe API call failed — fall back to DB
        // If the card being removed is the DB default, assume it's
        // the only card (conservative — better to block than allow)
        this.logger.warn(
          `remove-card: failed to list payment methods from Stripe for customer ${customerId}: ${stripeErr.message} — falling back to DB check`,
        );
        attachedCardCount = customer.stripeDefaultPaymentMethodId === paymentMethodId ? 1 : 0;
      }
    } else {
      // No Stripe customer ID — fall back to DB
      this.logger.warn(
        `remove-card: customer ${customerId} has no stripeCustomerId — falling back to DB check`,
      );
      attachedCardCount = customer.stripeDefaultPaymentMethodId === paymentMethodId ? 1 : 0;
    }

    if (attachedCardCount <= 1) {
      throw new BadRequestException(
        "This is your only payment method on file. " +
        "Please add a new card first — it will become your default automatically — " +
        "then you can remove this one.",
      );
    }

    // ── Note: we do NOT block card deletion for active deliveries ──
    // When a card is detached from a Stripe customer, existing
    // PaymentIntents that already have the card attached are NOT
    // affected — the PM stays locked to the PI. So:
    //   - LISTED/BOOKED deliveries: the existing PI still works at capture
    //   - ACTIVE deliveries: lock-in already captured, remainder creates
    //     a new PI using the new default card
    //   - Postpaid: invoice uses invoice_settings.default_payment_method
    //     which we auto-update to the remaining card
    //
    // Since we already block single-card deletion above, when there are
    // 2+ cards it's always safe to delete one. The backend auto-sets
    // the next card as the new default (both DB + Stripe).

    // All checks passed — proceed with removal
    try {
      await this.stripeService.detachPaymentMethod(paymentMethodId);

      // Clear default if it was the removed card
      if (customer.stripeDefaultPaymentMethodId === paymentMethodId) {
        // If there are other cards, auto-set one of them as the new default
        const remainingCards = await this.stripeService.listPaymentMethods(
          customer.stripeCustomerId!,
        );
        if (remainingCards.length > 0) {
          const newDefault = remainingCards[0].id;
          await this.prisma.customer.update({
            where: { id: customerId },
            data: { stripeDefaultPaymentMethodId: newDefault },
          });
          // Also update Stripe's invoice_settings.default_payment_method
          // so postpaid invoices use the new default card
          try {
            await this.stripeService.stripe.customers.update(
              customer.stripeCustomerId!,
              { invoice_settings: { default_payment_method: newDefault } },
            );
          } catch (stripeErr: any) {
            this.logger.error(
              `Failed to update Stripe invoice_settings after card removal: ${stripeErr.message}`,
            );
          }
        } else {
          // No remaining cards — clear the default (shouldn't happen
          // because we blocked single-card deletion above, but defensive)
          await this.prisma.customer.update({
            where: { id: customerId },
            data: { stripeDefaultPaymentMethodId: null },
          });
        }
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to remove payment method: ${err.message}`);
      throw new BadRequestException(
        this.translateStripeCardError(err, 'We could not remove your card at this time. Please try again or contact support.'),
      );
    }
  }

  // ── Stripe Connect (Driver Payouts) ──────────────────────────

  /**
   * Create or retrieve a Stripe Connect account for a driver.
   * Called from driver dashboard "Payout Setup" page.
   * Pre-fills SSN, name, address, DOB from onboarding data so the Stripe
   * onboarding page only asks for bank account + ID verification.
   */
  @Post("stripe/connect/onboarding")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async startConnectOnboarding(
    @Body() body: { driverId: string },
    @Req() req: any,
  ) {
    const { driverId } = body;
    if (!driverId) {
      throw new BadRequestException("driverId is required");
    }

    // Fetch driver with personal data + user relation
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeConnectOnboardingComplete: true,
        ssnLastFour: true,
        dateOfBirth: true,
        residentialAddressLine1: true,
        residentialAddressLine2: true,
        residentialCity: true,
        residentialState: true,
        residentialZip: true,
        agreementAcceptedAt: true,
        user: { select: { email: true, fullName: true } },
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }

    try {
      let accountId = driver.stripeConnectAccountId;

      // Create Connect account if driver doesn't have one
      if (!accountId) {
        const account = await this.stripeService.createConnectAccount({
          email: driver.user?.email || '',
          driverId: driver.id,
          country: 'US',
        });
        accountId = account.id;

        await this.prisma.driver.update({
          where: { id: driverId },
          data: { stripeConnectAccountId: accountId },
        });
      }

      // ── Pre-fill driver data into Connect account ────────────────
      // Parse fullName into first/last name (fullName may be null or single word)
      const nameParts = (driver.user?.fullName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

      // Parse dateOfBirth into day/month/year
      let dob: { day: number; month: number; year: number } | undefined;
      if (driver.dateOfBirth) {
        const dobDate = new Date(driver.dateOfBirth);
        dob = {
          day: dobDate.getUTCDate(),
          month: dobDate.getUTCMonth() + 1,
          year: dobDate.getUTCFullYear(),
        };
      }

      // Get caller IP for TOS acceptance
      const clientIp = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || req?.ip
        || '127.0.0.1';

      try {
        await this.stripeService.updateConnectAccount(accountId, {
          businessType: 'individual',
          firstName,
          lastName,
          dob,
          ssnLast4: driver.ssnLastFour || undefined,
          businessUrl: process.env.FRONTEND_URL || 'https://101drivers.techbee.et',
          address: {
            line1: driver.residentialAddressLine1 || undefined,
            line2: driver.residentialAddressLine2 || undefined,
            city: driver.residentialCity || undefined,
            state: driver.residentialState || undefined,
            postalCode: driver.residentialZip || undefined,
          },
          // Auto-accept TOS if driver already accepted our agreement
          ...(driver.agreementAcceptedAt ? {
            tosAccepted: {
              date: Math.floor(new Date(driver.agreementAcceptedAt).getTime() / 1000),
              ip: clientIp,
            },
          } : {}),
        });
        this.logger.log(`Pre-filled Connect account ${accountId} for driver ${driverId} with SSN, name, address, DOB`);
      } catch (prefillErr: any) {
        // Non-blocking: if pre-fill fails, onboarding still works (driver enters manually)
        this.logger.warn(`Connect pre-fill warning for driver ${driverId}: ${prefillErr.message}`);
      }
      // ── End pre-fill ────────────────────────────────────────────

      // Generate onboarding link — point to existing /driver/wallet page
      const baseUrl = process.env.FRONTEND_URL || 'https://101drivers.techbee.et';
      const accountLink = await this.stripeService.createAccountLink({
        accountId,
        refreshUrl: `${baseUrl}/driver/wallet`,
        returnUrl: `${baseUrl}/driver/wallet?stripe=complete`,
      });

      return {
        url: accountLink.url,
        accountId,
        onboardingComplete: driver.stripeConnectOnboardingComplete,
      };
    } catch (err: any) {
      this.logger.error(`Connect onboarding failed for driver ${driverId}: ${err.message}`);
      throw new BadRequestException(`Failed to start payout setup: ${err.message}`);
    }
  }

  /**
   * Get the Stripe Connect account status for a driver.
   */
  @Get("stripe/connect/status/:driverId")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async getConnectStatus(@Param("driverId") driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeConnectOnboardingComplete: true,
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }

    if (!driver.stripeConnectAccountId) {
      return { setupComplete: false, needsOnboarding: true };
    }

    try {
      const account = await this.stripeService.getConnectAccount(driver.stripeConnectAccountId);
      const detailsSubmitted = (account as any).details_submitted === true;

      // Sync onboarding complete status
      if (detailsSubmitted && !driver.stripeConnectOnboardingComplete) {
        await this.prisma.driver.update({
          where: { id: driverId },
          data: { stripeConnectOnboardingComplete: true },
        });
      }

      return {
        setupComplete: detailsSubmitted,
        needsOnboarding: !detailsSubmitted,
        accountId: driver.stripeConnectAccountId,
      };
    } catch (err: any) {
      this.logger.error(`Failed to get Connect status for driver ${driverId}: ${err.message}`);
      return {
        setupComplete: false,
        needsOnboarding: true,
        accountId: driver.stripeConnectAccountId,
      };
    }
  }

  // ── Invoice Endpoints ────────────────────────────────────────

  /**
   * Get invoices for the current dealer (customer).
   */
  @Get("invoices/customer/:customerId")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async getCustomerInvoices(
    @Param("customerId") customerId: string,
    @Query() query: any,
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const results = await this.prisma.invoice.findMany({
      where: { customerId },
      include: {
        payment: {
          select: {
            status: true,
            paymentType: true,
            provider: true,
            delivery: {
              select: {
                pickupAddress: true,
                dropoffAddress: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const count = await this.prisma.invoice.count({
      where: { customerId },
    });

    return { items: results, count, page, pageSize };
  }

  /**
   * Admin: Get all invoices with filters.
   */
  @Get("invoices/admin")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async getAdminInvoices(@Query() query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.overdueOnly === 'true') {
      where.status = 'PENDING';
      where.dueDate = { lt: new Date() };
    }
    if (query.from || query.to) {
      where.issuedAt = {};
      if (query.from) where.issuedAt.gte = new Date(query.from);
      if (query.to) where.issuedAt.lte = new Date(query.to);
    }

    const [items, count] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              businessName: true,
              contactEmail: true,
              contactName: true,
            },
          },
          payment: {
            select: {
              status: true,
              paymentType: true,
              provider: true,
              delivery: {
                select: {
                  pickupAddress: true,
                  dropoffAddress: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, count, page, pageSize };
  }

  /**
   * Admin: Mark an invoice as PAID.
   */
  @Post("invoices/:invoiceId/mark-paid")
  @UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
  async markInvoicePaid(
    @Param("invoiceId") invoiceId: string,
    @Body() body?: { note?: string },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // Also mark linked payment as PAID if postpaid + INVOICED
      if (invoice.paymentId) {
        const payment = await tx.payment.findUnique({
          where: { id: invoice.paymentId },
          select: { status: true, paymentType: true },
        });

        if (payment?.paymentType === 'POSTPAID' && payment?.status === 'INVOICED') {
          await tx.payment.update({
            where: { id: invoice.paymentId },
            data: { status: 'PAID', paidAt: new Date() },
          });

          await tx.paymentEvent.create({
            data: {
              paymentId: invoice.paymentId,
              type: 'MARK_PAID',
              status: 'PAID',
              amount: invoice.amount,
              message: `Invoice ${invoice.invoiceNumber} marked as paid${body?.note ? `. ${body.note}` : ''}`,
            },
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          action: 'PAYMENT_OVERRIDE',
          actorType: 'USER',
          deliveryId: invoice.deliveryId,
          reason: `Invoice ${invoice.invoiceNumber} marked paid${body?.note ? `. ${body.note}` : ''}`,
        },
      });
    });

    this.logger.log(`Invoice ${invoice.invoiceNumber} marked as paid`);
    return { success: true, invoiceNumber: invoice.invoiceNumber };
  }

  // ─────────────────────────────────────────────────────────────────
  // Translate Stripe SDK errors on save-card / remove-card flows into
  // dealer-facing English. Never leaks Stripe's "Request req_xxx:" prefix,
  // internal ids (pm_, in_, sub_, ch_, pi_), or API-key hints to the dealer.
  //
  // Recognized dealer-facing errors:
  //   • card_declined (with decline_code) — card-level declines
  //   • expired_card / incorrect_cvc / incorrect_number — bad card data
  //   • processing_error — transient Stripe-side issue
  //   • StripeAuthenticationError — our API keys are wrong (don't tell the dealer)
  //   • APIConnectionError — network blip between us and Stripe
  //
  // Falls back to `fallbackMsg` (a generic "please try again or contact
  // support" line supplied by the caller) for anything unrecognized.
  // ─────────────────────────────────────────────────────────────────
  private translateStripeCardError(err: any, fallbackMsg: string): string {
    const code = err?.code || '';
    const declineCode = err?.decline_code || '';

    // Card-level declines — these are dealer-actionable.
    if (code === 'card_declined' || declineCode) {
      switch (declineCode) {
        case 'insufficient_funds':
          return 'Your card was declined for insufficient funds. Please use a different card.';
        case 'expired_card':
          return 'Your card has expired. Please save a new card.';
        case 'incorrect_cvc':
          return 'The security code on your card is incorrect. Please update your card.';
        case 'lost_card':
        case 'stolen_card':
          return 'Your card was reported lost or stolen. Please use a different card.';
        case 'do_not_honor':
          return 'Your bank declined the charge. Please call the number on your card to authorize it.';
        case 'transaction_not_allowed':
          return 'Your bank does not allow this type of charge on this card. Please use a different card.';
        case 'fraudulent':
        case 'pickup_card':
          return 'Your card was declined for security reasons. Please use a different card.';
        default:
          return 'Your card was declined. Please use a different card or contact your bank.';
      }
    }
    if (code === 'expired_card') return 'Your card has expired. Please save a new card.';
    if (code === 'incorrect_number') return 'The card number is incorrect. Please save a new card.';
    if (code === 'invalid_cvc') return 'The security code on your card is incorrect. Please save a new card.';
    if (code === 'processing_error') return 'An error occurred while processing your card. Please try again in a moment.';

    // Internal Stripe config / network issues — don't leak to the dealer.
    if (err?.type === 'StripeAuthenticationError' || err?.type === 'StripeInvalidApiKeyError') {
      return 'We could not process your request at this time. Please contact support.';
    }
    if (err?.type === 'StripeConnectionError' || err?.type === 'APIConnectionError') {
      return 'We could not reach the payment processor. Please try again in a moment.';
    }

    // Generic fallback. Try to surface the (cleaned) Stripe message only if
    // it doesn't contain internal Stripe ids; otherwise use fallbackMsg.
    const cleaned = String(err?.message || '')
      .replace(/^Request req_[A-Za-z0-9]+:\s*/i, '')
      .trim();
    const looksSafe = !!cleaned && !/(pm_|in_|sub_|cust|req_|ch_|pi_)[A-Za-z0-9]+/i.test(cleaned);
    return looksSafe ? `We could not process your request: ${cleaned}.` : fallbackMsg;
  }
}

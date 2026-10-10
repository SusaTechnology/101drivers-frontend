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
    @Req() req: any,
  ) {
    const { deliveryId, amount } = body;

    if (!deliveryId || !amount || amount <= 0) {
      throw new BadRequestException("Invalid delivery ID or tip amount");
    }

    if (amount > 500) {
      throw new BadRequestException("Tip amount cannot exceed $500");
    }

    // ── Ownership check: only the delivery's own dealer (or an admin) may ──
    // charge a card here. Without this, ANY authenticated user could tip
    // ANY dealer's saved card for any completed delivery.
    // req.user = { id, username, roles } from the JWT.
    const caller = req?.user as any;
    const callerIsAdmin = Array.isArray(caller?.roles)
      ? caller.roles.includes("ADMIN")
      : caller?.roles === "ADMIN";

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
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (!callerIsAdmin && delivery.customer?.user?.id !== caller?.id) {
      throw new BadRequestException("You can only add a tip to your own deliveries");
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
      try {
        const pi = await this.stripeService.getPaymentIntent(existingTip.providerRef);
        if (pi.status === 'succeeded') {
          // ── Server-side double-charge guard ──
          // The UI hides the tip form after a successful tip, but the API
          // previously fell through and created a NEW PaymentIntent → the
          // dealer's card charged twice. Reject here instead.
          throw new BadRequestException(
            "A tip has already been added to this delivery",
          );
        }
        const terminalStatuses = ['canceled', 'cancelled'];
        if (!terminalStatuses.includes(pi.status)) {
          // Non-terminal (processing / requires_action) — let the frontend
          // resume the same PaymentIntent instead of creating a new one.
          return {
            paymentIntentId: pi.id,
            clientSecret: pi.client_secret,
            status: pi.status,
            amount: pi.amount / 100,
          };
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        // PaymentIntent not found or API error — fall through and create new one
      }
    }

    // ── Create the Tip row BEFORE confirming the PaymentIntent ──
    // This closes the webhook race: with confirm:true the charge can land
    // and the payment_intent.succeeded webhook can arrive BEFORE the Tip row
    // existed — the webhook found no tip, gave up (200), and the tip money
    // was never credited to the driver. Row-first means the webhook always
    // finds the row.
    let tipId: string;
    if (existingTip) {
      const updated = await this.prisma.tip.update({
        where: { deliveryId },
        data: { amount, provider: "STRIPE", status: "AUTHORIZED" as any },
        select: { id: true },
      });
      tipId = updated.id;
    } else {
      const created = await this.prisma.tip.create({
        data: {
          amount,
          deliveryId,
          provider: "STRIPE",
          status: "AUTHORIZED" as any,
        },
        select: { id: true },
      });
      tipId = created.id;
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

      // Update the tip row created BEFORE the PI was confirmed (race fix).
      // The row already exists with tipId — just stamp the PI reference and
      // the final status.
      const tipStatus =
        finalStatus === "succeeded" ? "CAPTURED" :
        finalStatus === "requires_action" ? "AUTHORIZED" :
        finalStatus === "requires_capture" ? "AUTHORIZED" :
        "AUTHORIZED";
      await this.prisma.tip.update({
        where: { id: tipId },
        data: {
          amount,
          provider: "STRIPE",
          providerRef: result.paymentIntentId,
          status: tipStatus as any,
        },
        select: { id: true },
      });

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
    @Req() request?: any,
  ) {
    // Task 127: record WHO processed the refund. The webhook that later
    // writes the REFUND PaymentEvent reads this metadata back, so the
    // admin panel's Payment Events timeline can show "Processed by <name>".
    const refundedBy =
      request?.user?.fullName ||
      request?.user?.email ||
      request?.user?.id ||
      'admin';
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
    // Task 127: REFUNDED + anything other than PARTIAL counts as fully
    // refunded. Legacy rows refunded before the partial-refund fields
    // existed keep the default refundStatus = NONE (or null), and `status`
    // has only ever been flipped to REFUNDED on FULL refunds — so they
    // must be blocked here too, not sent to Stripe to fail.
    if (payment.status === 'REFUNDED' && (payment as any).refundStatus !== 'PARTIAL') {
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
          refundedBy,
          // Task 127: only attach adminNote when the admin actually typed a
          // reason. The old hardcoded "Full refund processed by admin" default
          // is not a reason — showing it as one on the timeline is noise.
          ...(body?.note ? { adminNote: body.note } : {}),
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
      // Our own validation throws (already fully refunded, bad status, no
      // charge, amount over remaining) are ALREADY admin-specific — re-throw
      // them untouched instead of flattening them into the generic fallback.
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      const friendly = this.translateRefundError(err);
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
        phone: true,
        user: { select: { email: true, fullName: true, phone: true } },
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

      // ── Normalize the driver's phone for Stripe (E.164) ───────────
      // Driver.phone / User.phone are free-form in our DB. Stripe expects
      // a callable number for `individual.phone` (the field its hosted
      // onboarding prefills). We only push values we can normalize
      // confidently — otherwise we push nothing and Stripe asks the
      // driver, exactly like before. Pushing the CURRENT number on every
      // onboarding start also SELF-HEALS accounts where Stripe stored a
      // wrong number in an earlier partial attempt (Stripe persists what
      // the driver typed and keeps prefilling it forever).
      const rawPhone = (driver.phone || driver.user?.phone || '').trim();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      let phoneForStripe: string | undefined;
      if (
        rawPhone.startsWith('+') &&
        phoneDigits.length >= 8 &&
        phoneDigits.length <= 15
      ) {
        // Already international — trust it.
        phoneForStripe = `+${phoneDigits}`;
      } else if (phoneDigits.length === 10) {
        // US national format (area code + number) — our drivers are US-based.
        phoneForStripe = `+1${phoneDigits}`;
      } else if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
        phoneForStripe = `+${phoneDigits}`;
      }

      // Get caller IP for TOS acceptance
      const clientIp = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || req?.ip
        || '127.0.0.1';

      try {
        const prefilledAccount = await this.stripeService.updateConnectAccount(accountId, {
          businessType: 'individual',
          firstName,
          lastName,
          phone: phoneForStripe,
          supportPhone: phoneForStripe,
          // Industry + product description pre-filled by the platform so
          // Stripe never asks drivers "what does your business do?" —
          // drivers are not businesses, they are recipients of payouts.
          // 4215 = Courier Services (local pick-up and delivery).
          mcc: '4215',
          productDescription:
            'Driver payouts for deliveries booked through the 101 Drivers marketplace',
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
        this.logger.log(`Pre-filled Connect account ${accountId} for driver ${driverId} with SSN, name, phone, address, DOB, business profile`);
        // Observability: whatever remains in `currently_due` is EXACTLY what
        // Stripe will show the driver on the next onboarding link. This log
        // line answers any future "why is Stripe asking X" report without
        // guessing — read it, push that field, question gone.
        this.logger.log(
          `Connect onboarding will still ask driver ${driverId} for: ${JSON.stringify(
            prefilledAccount?.requirements?.currently_due ?? [],
          )}`,
        );
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
        user: { select: { fullName: true } },
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

      // ── Name-mismatch flag (FLAG ONLY — no automatic correction) ──
      // Stripe's hosted form lets the account holder type/edit their own
      // name, so the legal name Stripe holds can drift from the profile
      // name (real case: a driver entered "Just A Driver" at Stripe).
      // A mismatched name can trigger ID-verification payout holds and
      // breaks year-end 1099 name/TIN matching. We compare normalized
      // names and return the flag so the driver wallet shows a warning;
      // the driver (or ops, via this log line) decides what to do.
      const profileName = (driver.user?.fullName ?? '').replace(/\s+/g, ' ').trim();
      const individual = (account as any).individual ?? {};
      const stripeName = [individual.first_name, individual.last_name]
        .filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const comparable = (v: string) => v.toLowerCase();
      const nameMatchesProfile: boolean | null =
        stripeName && profileName
          ? comparable(stripeName) === comparable(profileName)
          : null;
      if (nameMatchesProfile === false) {
        this.logger.warn(
          `Connect name mismatch for driver ${driverId}: Stripe="${stripeName}" profile="${profileName}"`,
        );
      }

      return {
        setupComplete: detailsSubmitted,
        needsOnboarding: !detailsSubmitted,
        accountId: driver.stripeConnectAccountId,
        nameOnStripe: stripeName || null,
        profileName: profileName || null,
        nameMatchesProfile,
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

  /**
   * Refund-specific Stripe error translation (Task 126).
   *
   * The shared translateStripeCardError() is DEALER-facing: it masks any
   * Stripe message containing charge/payment-intent ids and tells the reader
   * to "contact support". Neither makes sense on the admin page — the admin
   * IS support and has Stripe dashboard access, so refund errors must say
   * exactly what went wrong and what to do next (owner request: "let them
   * know the detail why they cannot refund on the toast").
   */
  private translateRefundError(err: any): string {
    const code = err?.code || '';

    // Refund-declined codes — each with the reason + the next step.
    if (code === 'charge_already_refunded') {
      return 'This charge has already been fully refunded at Stripe. The payment record here will update within a few minutes — no further refund is needed.';
    }
    if (code === 'charge_disputed') {
      return 'This payment is disputed — refunds must be handled through the Stripe dispute process. Open the payment in the Stripe dashboard.';
    }
    if (code === 'insufficient_funds' || code === 'insufficient_balance') {
      return 'The Stripe account balance is too low to cover this refund. Add funds to the Stripe balance, then retry the refund.';
    }
    if (code === 'resource_missing') {
      return 'The Stripe charge for this payment could not be found. Verify the payment in the Stripe dashboard before retrying.';
    }
    if (code === 'amount_too_large' || code === 'amount_too_small') {
      const cleaned = String(err?.message || '')
        .replace(/^Request req_[A-Za-z0-9]+:\s*/i, '')
        .trim();
      return `Stripe rejected the refund amount${cleaned ? `: ${cleaned}` : '.'}`;
    }

    // Connectivity / Stripe-side outages — nothing moved, safe to retry.
    if (err?.type === 'StripeConnectionError' || err?.type === 'APIConnectionError') {
      return 'We could not reach Stripe. No refund was issued — please try again in a moment.';
    }
    if (err?.type === 'StripeAPIError' || (Number(err?.statusCode) || 0) >= 500) {
      return 'Stripe is temporarily unavailable. No refund was issued — please try again in a moment.';
    }

    // Anything else: surface the (request-id-stripped) Stripe message as-is.
    // Admins can act on it and cross-check the Stripe dashboard, so unlike
    // the dealer path we do NOT mask charge / payment-intent ids here.
    const cleaned = String(err?.message || '')
      .replace(/^Request req_[A-Za-z0-9]+:\s*/i, '')
      .trim();
    return cleaned
      ? `Refund declined by Stripe: ${cleaned}`
      : 'Refund failed at Stripe. No money has moved — check this payment in the Stripe dashboard, then try again.';
  }
}

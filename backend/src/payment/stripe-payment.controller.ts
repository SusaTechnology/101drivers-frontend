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
      select: { id: true, status: true },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery not found");
    }

    if (delivery.status !== "COMPLETED") {
      throw new BadRequestException("Tips can only be added to completed deliveries");
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
      throw new BadRequestException(`Failed to create SetupIntent: ${err.message}`);
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

      const cards = methods.map((m) => ({
        id: m.id,
        brand: (m.card as any)?.brand || "unknown",
        last4: (m.card as any)?.last4 || "****",
        expMonth: (m.card as any)?.exp_month,
        expYear: (m.card as any)?.exp_year,
        isDefault: m.id === customer.stripeDefaultPaymentMethodId,
      }));

      return {
        cards,
        defaultPaymentMethodId: customer.stripeDefaultPaymentMethodId,
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
      select: { id: true, stripeDefaultPaymentMethodId: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    try {
      await this.stripeService.detachPaymentMethod(paymentMethodId);

      // Clear default if it was the removed card
      if (customer.stripeDefaultPaymentMethodId === paymentMethodId) {
        await this.prisma.customer.update({
          where: { id: customerId },
          data: { stripeDefaultPaymentMethodId: null },
        });
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to remove payment method: ${err.message}`);
      throw new BadRequestException(`Failed to remove card: ${err.message}`);
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
}

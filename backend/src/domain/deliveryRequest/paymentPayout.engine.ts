import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDriverPayoutStatus,
  EnumInvoicePaymentTerms,
  EnumInvoiceStatus,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { StripeService } from "../../providers/stripe/stripe.service";

type Tx = Prisma.TransactionClient;

@Injectable()
export class PaymentPayoutEngine {
  private readonly logger = new Logger(PaymentPayoutEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(StripeService)
    private readonly stripeService?: StripeService,
  ) {}

  async getDeliveryFinancialSummary(deliveryId: string) {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        payment: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            status: true,
            invoiceId: true,
          },
        },
        payout: {
          select: {
            id: true,
            grossAmount: true,
            insuranceFee: true,
            platformFee: true,
            netAmount: true,
            driverSharePct: true,
            status: true,
          },
        },
        tip: {
          select: {
            amount: true,
            status: true,
          },
        },
        quote: {
          select: {
            estimatedPrice: true,
            pricingSnapshot: true,
            feesBreakdown: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    const breakdown = this.computeBreakdown({
      amount:
        delivery.payment?.amount ??
        delivery.quote?.estimatedPrice ??
        0,
      pricingSnapshot: delivery.quote?.pricingSnapshot ?? null,
      feesBreakdown: delivery.quote?.feesBreakdown ?? null,
      tipAmount:
        delivery.tip &&
        ["AUTHORIZED", "CAPTURED"].includes(delivery.tip.status)
          ? Number((delivery.tip.amount ?? 0).toFixed(2))
          : 0,
    });

    return {
      deliveryId: delivery.id,
      paymentId: delivery.payment?.id ?? null,
      payoutId: delivery.payout?.id ?? null,
      paymentType: delivery.payment?.paymentType ?? null,
      paymentStatus: delivery.payment?.status ?? null,
      payoutStatus: delivery.payout?.status ?? null,
      grossAmount: delivery.payout?.grossAmount ?? breakdown.grossAmount,
      driverSharePct:
        delivery.payout?.driverSharePct ?? breakdown.driverSharePct,
      insuranceFee:
        delivery.payout?.insuranceFee ?? breakdown.insuranceFee,
      platformFee:
        delivery.payout?.platformFee ?? breakdown.platformFee,
      tipAmount: breakdown.tipAmount,
      netPayoutAmount:
        delivery.payout?.netAmount ?? breakdown.netAmount,
      invoiceId: delivery.payment?.invoiceId ?? null,
    };
  }

  async handleCompletionTx(
    tx: Tx,
    input: {
      deliveryId: string;
      actorUserId?: string | null;
    }
  ): Promise<void> {
    const delivery = await tx.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        payment: {
          select: {
            id: true,
            amount: true,
            paymentType: true,
            provider: true,
            status: true,
            providerPaymentIntentId: true,
            invoiceId: true,
          },
        },
        payout: {
          select: {
            id: true,
            status: true,
          },
        },
        tip: {
          select: {
            amount: true,
            status: true,
          },
        },
        quote: {
          select: {
            estimatedPrice: true,
            pricingSnapshot: true,
            feesBreakdown: true,
          },
        },
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "desc" },
          take: 1,
          select: {
            id: true,
            driverId: true,
            driver: {
              select: {
                id: true,
                stripeConnectAccountId: true,
                stripeConnectOnboardingComplete: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    const activeAssignment = delivery.assignments?.[0] ?? null;
    if (!activeAssignment) {
      return;
    }

    // ── PAYMENT CAPTURE ────────────────────────────────────────────────
    // Capture authorized Stripe PaymentIntents for prepaid deliveries.
    const payment = delivery.payment;
    if (payment) {
      if (
        payment.paymentType === EnumPaymentPaymentType.PREPAID &&
        payment.status === EnumPaymentStatus.AUTHORIZED &&
        payment.providerPaymentIntentId &&
        payment.provider === "STRIPE" &&
        this.stripeService
      ) {
        try {
          await this.captureWithRetry(payment.providerPaymentIntentId, input.deliveryId);
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: EnumPaymentStatus.CAPTURED, capturedAt: new Date() },
          });
          await tx.paymentEvent.create({
            data: {
              paymentId: payment.id,
              type: EnumPaymentEventType.CAPTURE,
              status: EnumPaymentEventStatus.CAPTURED,
              amount: payment.amount,
              message: "Prepaid payment captured at delivery completion",
              raw: { source: "delivery-complete", deliveryId: input.deliveryId },
            },
          });
        } catch (captureErr: any) {
          const errMsg = captureErr?.message || "Unknown capture error";
          this.logger.error(`Stripe capture failed for delivery ${input.deliveryId}: ${errMsg}`);
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: EnumPaymentStatus.FAILED },
          });
        }
      }
    }

    if (!payment) {
      return;
    }

    const tipAmount =
      delivery.tip &&
      ["AUTHORIZED", "CAPTURED"].includes(delivery.tip.status)
        ? Number((delivery.tip.amount ?? 0).toFixed(2))
        : 0;

    const breakdown = this.computeBreakdown({
      amount:
        payment.amount ??
        delivery.quote?.estimatedPrice ??
        0,
      pricingSnapshot: delivery.quote?.pricingSnapshot ?? null,
      feesBreakdown: delivery.quote?.feesBreakdown ?? null,
      tipAmount,
    });

    const payoutStatus =
      payment.paymentType === EnumPaymentPaymentType.POSTPAID &&
      payment.status !== EnumPaymentStatus.INVOICED &&
      payment.status !== EnumPaymentStatus.PAID
        ? EnumDriverPayoutStatus.PENDING
        : EnumDriverPayoutStatus.ELIGIBLE;

    await tx.driverPayout.upsert({
      where: { deliveryId: input.deliveryId },
      create: {
        deliveryId: input.deliveryId,
        driverId: activeAssignment.driverId,
        grossAmount: breakdown.grossAmount,
        insuranceFee: breakdown.insuranceFee,
        platformFee: breakdown.platformFee,
        netAmount: breakdown.netAmount,
        driverSharePct: breakdown.driverSharePct,
        status: payoutStatus,
      },
      update: {
        driverId: activeAssignment.driverId,
        grossAmount: breakdown.grossAmount,
        insuranceFee: breakdown.insuranceFee,
        platformFee: breakdown.platformFee,
        netAmount: breakdown.netAmount,
        driverSharePct: breakdown.driverSharePct,
        status: payoutStatus,
      },
    });

    // ── AUTO-TRANSFER to driver via Stripe Connect ──────────────
    // If payout is ELIGIBLE and driver has a completed Connect account,
    // automatically initiate the transfer (non-blocking, fire-and-forget).
    if (
      payoutStatus === EnumDriverPayoutStatus.ELIGIBLE &&
      this.stripeService &&
      activeAssignment.driver.stripeConnectAccountId &&
      activeAssignment.driver.stripeConnectOnboardingComplete
    ) {
      // Run transfer outside the transaction (fire-and-forget)
      this.initiateDriverTransfer(input.deliveryId, activeAssignment.driverId, breakdown.netAmount)
        .catch((err) => this.logger.error(`Auto-transfer failed for delivery ${input.deliveryId}: ${err.message}`));
    }
  }

  /**
   * Initiate a Stripe Connect transfer to a driver.
   * Updates the DriverPayout record with the transfer ID.
   */
  private async initiateDriverTransfer(
    deliveryId: string,
    driverId: string,
    amount: number,
  ): Promise<void> {
    const payout = await this.prisma.driverPayout.findUnique({
      where: { deliveryId },
    });
    if (!payout) return;

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { stripeConnectAccountId: true },
    });
    if (!driver?.stripeConnectAccountId) return;

    // Skip if transfer already initiated
    if (payout.providerTransferId) return;

    try {
      if (!this.stripeService) {
        this.logger.error('StripeService not available — cannot initiate transfer');
        return;
      }
      const transfer = await this.stripeService.createTransfer({
        amount,
        destinationAccountId: driver.stripeConnectAccountId,
        transferGroup: deliveryId,
        metadata: { deliveryId, driverId, payoutId: payout.id },
      });

      await this.prisma.driverPayout.update({
        where: { id: payout.id },
        data: {
          providerTransferId: transfer.id,
          status: EnumDriverPayoutStatus.PAID,
          paidAt: new Date(),
        },
      });

      this.logger.log(`Transfer ${transfer.id} initiated for delivery ${deliveryId} → driver ${driverId} ($${amount})`);
    } catch (err: any) {
      this.logger.error(`Transfer initiation failed for delivery ${deliveryId}: ${err.message}`);
      // Don't update status — webhook will handle it if transfer eventually succeeds/fails
    }
  }

  async adminInvoicePostpaid(input: {
    deliveryId: string;
    actorUserId?: string | null;
    invoiceId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
        payment: {
          select: {
            id: true,
            status: true,
            paymentType: true,
            invoiceId: true,
            amount: true,
          },
        },
        payout: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    if (!delivery.payment) {
      throw new BadRequestException("Delivery has no payment");
    }

    if (delivery.payment.paymentType !== EnumPaymentPaymentType.POSTPAID) {
      throw new BadRequestException("Only POSTPAID payments can be invoiced");
    }

    if (
      delivery.payment.status === EnumPaymentStatus.PAID ||
      delivery.payment.status === EnumPaymentStatus.REFUNDED ||
      delivery.payment.status === EnumPaymentStatus.VOIDED
    ) {
      throw new BadRequestException("Payment cannot be invoiced from current status");
    }

    await this.prisma.$transaction(async (tx) => {
      const beforePayment = await tx.payment.findUnique({
        where: { id: delivery.payment!.id },
      });

      await tx.payment.update({
        where: { id: delivery.payment!.id },
        data: {
          status: EnumPaymentStatus.INVOICED,
          invoiceId: input.invoiceId ?? undefined,
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: delivery.payment!.id,
          type: EnumPaymentEventType.INVOICE,
          status: EnumPaymentEventStatus.INVOICED,
          amount: delivery.payment!.amount,
          message: input.note ?? "Postpaid payment invoiced by admin",
          raw: {
            source: "admin-postpaid-invoice",
            deliveryId: input.deliveryId,
            actorUserId: input.actorUserId ?? null,
            invoiceId: input.invoiceId ?? null,
          },
        },
      });

      // Auto-generate Invoice record if not already linked
      if (delivery.payment && !delivery.payment.invoiceId && delivery.customerId) {
        const terms = EnumInvoicePaymentTerms.NET_15;
        const issuedAt = new Date();
        const dueDate = new Date(issuedAt);
        dueDate.setDate(dueDate.getDate() + 15);

        const dateStr = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
        const todayInvoices = await tx.invoice.count({
          where: { invoiceNumber: { startsWith: `INV-${dateStr}` } },
        });
        const invoiceNumber = `INV-${dateStr}-${String(todayInvoices + 1).padStart(4, '0')}`;

        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: delivery.customerId,
            paymentId: delivery.payment!.id,
            deliveryId: input.deliveryId,
            amount: delivery.payment!.amount,
            paymentTerms: terms,
            status: EnumInvoiceStatus.PENDING,
            issuedAt,
            dueDate,
          },
        });

        await tx.payment.update({
          where: { id: delivery.payment!.id },
          data: { invoiceId: invoice.id },
        });

        this.logger.log(
          `Auto-generated Invoice ${invoice.invoiceNumber} for delivery ${input.deliveryId}`,
        );
      }

      if (delivery.payout?.id) {
        await tx.driverPayout.update({
          where: { id: delivery.payout.id },
          data: {
            status: EnumDriverPayoutStatus.ELIGIBLE,
          },
        });
      }

      const afterPayment = await tx.payment.findUnique({
        where: { id: delivery.payment!.id },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PAYMENT_OVERRIDE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          reason: input.note ?? "Postpaid marked invoiced",
          beforeJson: beforePayment ?? Prisma.JsonNull,
          afterJson: afterPayment ?? Prisma.JsonNull,
        },
      });
    });
  }

  async adminMarkPostpaidPaid(input: {
    deliveryId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        payment: {
          select: {
            id: true,
            status: true,
            paymentType: true,
            amount: true,
          },
        },
        payout: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    if (!delivery.payment) {
      throw new BadRequestException("Delivery has no payment");
    }

    if (delivery.payment.paymentType !== EnumPaymentPaymentType.POSTPAID) {
      throw new BadRequestException("Only POSTPAID payments can be marked paid");
    }

    await this.prisma.$transaction(async (tx) => {
      const beforePayment = await tx.payment.findUnique({
        where: { id: delivery.payment!.id },
      });

      await tx.payment.update({
        where: { id: delivery.payment!.id },
        data: {
          status: EnumPaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: delivery.payment!.id,
          type: EnumPaymentEventType.MARK_PAID,
          status: EnumPaymentEventStatus.PAID,
          amount: delivery.payment!.amount,
          message: input.note ?? "Postpaid payment marked paid by admin",
          raw: {
            source: "admin-postpaid-paid",
            deliveryId: input.deliveryId,
            actorUserId: input.actorUserId ?? null,
          },
        },
      });

      if (delivery.payout?.id) {
        await tx.driverPayout.update({
          where: { id: delivery.payout.id },
          data: {
            status: EnumDriverPayoutStatus.ELIGIBLE,
          },
        });
      }

      const afterPayment = await tx.payment.findUnique({
        where: { id: delivery.payment!.id },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PAYMENT_OVERRIDE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          reason: input.note ?? "Postpaid marked paid",
          beforeJson: beforePayment ?? Prisma.JsonNull,
          afterJson: afterPayment ?? Prisma.JsonNull,
        },
      });
    });
  }

  async adminMarkPayoutPaid(input: {
    deliveryId: string;
    actorUserId?: string | null;
    providerTransferId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: input.deliveryId },
      select: {
        id: true,
        payout: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException("Delivery request not found");
    }

    if (!delivery.payout) {
      throw new BadRequestException("Delivery has no payout");
    }

    await this.prisma.$transaction(async (tx) => {
      const beforePayout = await tx.driverPayout.findUnique({
        where: { id: delivery.payout!.id },
      });

      await tx.driverPayout.update({
        where: { id: delivery.payout!.id },
        data: {
          status: EnumDriverPayoutStatus.PAID,
          paidAt: new Date(),
          providerTransferId: input.providerTransferId ?? undefined,
        },
      });

      const afterPayout = await tx.driverPayout.findUnique({
        where: { id: delivery.payout!.id },
      });

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PAYOUT_OVERRIDE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: input.deliveryId,
          driverId: beforePayout?.driverId ?? null,
          reason: input.note ?? "Driver payout marked paid",
          beforeJson: beforePayout ?? Prisma.JsonNull,
          afterJson: afterPayout ?? Prisma.JsonNull,
        },
      });
    });
  }

  // ── Invoice Methods ────────────────────────────────────────────

  /**
   * Generate an Invoice record for a postpaid delivery.
   * Called during adminInvoicePostpaid() or automatically on postpaid delivery completion.
   * Returns the created Invoice.
   */
  async generateInvoice(input: {
    paymentId: string;
    deliveryId: string;
    customerId: string;
    amount: number;
    paymentTerms?: EnumInvoicePaymentTerms;
    actorUserId?: string;
  }) {
    const terms = input.paymentTerms || EnumInvoicePaymentTerms.NET_15;
    const issuedAt = new Date();
    const dueDate = new Date(issuedAt);

    if (terms === EnumInvoicePaymentTerms.NET_15) {
      dueDate.setDate(dueDate.getDate() + 15);
    } else if (terms === EnumInvoicePaymentTerms.NET_30) {
      dueDate.setDate(dueDate.getDate() + 30);
    }
    // DUE_ON_RECEIPT: dueDate stays as issuedAt

    // Generate invoice number: INV-YYYYMMDD-XXXX (sequential per day)
    const dateStr = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const todayInvoices = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: `INV-${dateStr}` },
      },
    });
    const invoiceNumber = `INV-${dateStr}-${String(todayInvoices + 1).padStart(4, '0')}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: input.customerId,
        paymentId: input.paymentId,
        deliveryId: input.deliveryId,
        amount: input.amount,
        paymentTerms: terms,
        status: EnumInvoiceStatus.PENDING,
        issuedAt,
        dueDate,
      },
    });

    // Link invoice to payment record
    await this.prisma.payment.update({
      where: { id: input.paymentId },
      data: { invoiceId: invoice.id },
    });

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} created for payment ${input.paymentId} (delivery ${input.deliveryId}), due ${dueDate.toISOString()}`,
    );

    return invoice;
  }

  /**
   * Get invoices for a specific customer (dealer view).
   */
  async getCustomerInvoices(customerId: string, params?: {
    status?: EnumInvoiceStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = params?.page || 1;
    const pageSize = Math.min(params?.pageSize || 20, 100);

    const where: Record<string, any> = { customerId };
    if (params?.status) where.status = params.status;

    const [items, count] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
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
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, count, page, pageSize };
  }

  /**
   * Get invoices for admin (all customers, with filters).
   */
  async getAdminInvoices(params?: {
    status?: EnumInvoiceStatus;
    customerId?: string;
    overdueOnly?: boolean;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = params?.page || 1;
    const pageSize = Math.min(params?.pageSize || 20, 100);

    const where: Record<string, any> = {};

    if (params?.status) where.status = params.status;
    if (params?.customerId) where.customerId = params.customerId;
    if (params?.overdueOnly) {
      where.status = EnumInvoiceStatus.PENDING;
      where.dueDate = { lt: new Date() };
    }
    if (params?.from || params?.to) {
      where.issuedAt = {};
      if (params?.from) where.issuedAt.gte = new Date(params.from);
      if (params?.to) where.issuedAt.lte = new Date(params.to);
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
   * Mark an invoice as PAID.
   */
  async markInvoicePaid(input: {
    invoiceId: string;
    actorUserId?: string;
    note?: string;
  }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${input.invoiceId} not found`);
    }

    if (invoice.status === EnumInvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          status: EnumInvoiceStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Also mark the linked payment as PAID if it's a postpaid INVOICED payment
      if (invoice.paymentId) {
        const payment = await tx.payment.findUnique({
          where: { id: invoice.paymentId },
          select: { status: true, paymentType: true },
        });

        if (
          payment &&
          payment.paymentType === EnumPaymentPaymentType.POSTPAID &&
          payment.status === EnumPaymentStatus.INVOICED
        ) {
          await tx.payment.update({
            where: { id: invoice.paymentId },
            data: {
              status: EnumPaymentStatus.PAID,
              paidAt: new Date(),
            },
          });

          // Create payment event
          await tx.paymentEvent.create({
            data: {
              paymentId: invoice.paymentId,
              type: EnumPaymentEventType.MARK_PAID,
              status: EnumPaymentEventStatus.PAID,
              amount: invoice.amount,
              message: `Invoice ${invoice.invoiceNumber} marked as paid. ${input.note || ''}`.trim(),
            },
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          action: EnumAdminAuditLogAction.PAYMENT_OVERRIDE,
          actorUserId: input.actorUserId ?? null,
          actorType: EnumAdminAuditLogActorType.USER,
          deliveryId: invoice.deliveryId,
          reason: `Invoice ${invoice.invoiceNumber} marked paid. ${input.note || ''}`.trim(),
        },
      });
    });

    this.logger.log(`Invoice ${invoice.invoiceNumber} marked as paid`);
    return { success: true, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Check for overdue invoices and update their status.
   * Should be called periodically (cron/scheduler).
   */
  async processOverdueInvoices(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.invoice.updateMany({
      where: {
        status: EnumInvoiceStatus.PENDING,
        dueDate: { lt: now },
      },
      data: {
        status: EnumInvoiceStatus.OVERDUE,
      },
    });

    const count = result.count;
    if (count > 0) {
      this.logger.log(`Marked ${count} invoice(s) as OVERDUE`);
    }
    return count;
  }

  // ── Private Helpers ──────────────────────────────────────────

  private computeBreakdown(input: {
    amount: number;
    pricingSnapshot: unknown;
    feesBreakdown: unknown;
    tipAmount: number;
  }) {
    const snapshot = (input.pricingSnapshot ?? {}) as Record<string, unknown>;
    const fees = (input.feesBreakdown ?? {}) as Record<string, unknown>;

    const grossAmount = Number((input.amount ?? 0).toFixed(2));

    const driverSharePct =
      this.toNumber(snapshot.driverSharePct) ?? 60;

    const insuranceFee =
      this.toNumber(fees.insuranceFee) ??
      this.toNumber(snapshot.insuranceFee) ??
      0;

    const driverShareAmount = Number(
      (grossAmount * (driverSharePct / 100)).toFixed(2)
    );

    const platformFee = Number(
      (grossAmount - driverShareAmount).toFixed(2)
    );

    const tipAmount = Number((input.tipAmount ?? 0).toFixed(2));

    const netAmount = Number(
      Math.max(driverShareAmount - insuranceFee + tipAmount, 0).toFixed(2)
    );

    return {
      grossAmount,
      driverSharePct,
      insuranceFee: Number(insuranceFee.toFixed(2)),
      platformFee,
      tipAmount,
      netAmount,
    };
  }

  private toNumber(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Capture a Stripe PaymentIntent with exponential backoff retry.
   * Retries up to 3 times with 1s, 2s, 4s delays.
   * Throws if all attempts fail — the orchestrator will roll back the transaction.
   */
  private async captureWithRetry(
    paymentIntentId: string,
    deliveryId: string,
    maxRetries = 3,
  ): Promise<void> {
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.stripeService!.capturePaymentIntent(paymentIntentId, {
          idempotencyKey: `capture-${paymentIntentId}-${Date.now()}`,
        });
        this.logger.log(
          `Captured Stripe PI ${paymentIntentId} for delivery ${deliveryId}` +
            (attempt > 1 ? ` (attempt ${attempt})` : ""),
        );
        return;
      } catch (err: any) {
        const isRetryable =
          err.code === "connection_error" ||
          err.code === "rate_limit" ||
          err.statusCode === 500 ||
          err.statusCode === 502 ||
          err.statusCode === 503 ||
          err.statusCode === 504;

        if (attempt === maxRetries || !isRetryable) {
          this.logger.error(
            `Stripe capture failed for PI ${paymentIntentId} after ${attempt} attempt(s): ${err.message}`,
          );
          throw new BadRequestException(
            `Payment capture failed after ${attempt} attempt(s): ${err.message}`,
          );
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Stripe capture attempt ${attempt}/${maxRetries} failed for PI ${paymentIntentId}: ${err.message}. Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}

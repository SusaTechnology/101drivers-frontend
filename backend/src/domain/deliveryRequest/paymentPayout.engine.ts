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

  // ── Driver Withdrawal Methods ────────────────────────────────────

  // Configuration constants
  private readonly MIN_FREE_WITHDRAWAL = 50; // $50 minimum for free/manual payout
  private readonly MIN_INSTANT_PAYOUT = 5;   // $5 minimum for instant payout
  private readonly INSTANT_FEE = 1.5;         // $1.50 fee for instant payout

  /**
   * Get a driver's available balance (sum of ELIGIBLE DriverPayouts).
   */
  async getDriverAvailableBalance(driverId: string): Promise<number> {
    const result = await this.prisma.driverPayout.aggregate({
      where: { driverId, status: EnumDriverPayoutStatus.ELIGIBLE },
      _sum: { netAmount: true },
    });
    return Math.round((result._sum.netAmount || 0) * 100) / 100;
  }

  /**
   * Request a manual free withdrawal.
   * Collects all ELIGIBLE payouts for this driver into a PayoutBatch.
   * Minimum balance: $50. Arrives in 1-2 business days.
   */
  async requestFreeWithdrawal(driverId: string): Promise<any> {
    const availableBalance = await this.getDriverAvailableBalance(driverId);

    if (availableBalance < this.MIN_FREE_WITHDRAWAL) {
      throw new BadRequestException(
        `Minimum withdrawal amount is $${this.MIN_FREE_WITHDRAWAL}. Current balance: $${availableBalance.toFixed(2)}`,
      );
    }

    const existingPending = await this.prisma.payoutBatch.findFirst({
      where: { driverId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending withdrawal. Please wait for it to complete.',
      );
    }

    const eligiblePayouts = await this.prisma.driverPayout.findMany({
      where: { driverId, status: EnumDriverPayoutStatus.ELIGIBLE },
      select: { id: true, netAmount: true },
    });

    if (eligiblePayouts.length === 0) {
      throw new BadRequestException('No eligible payouts to withdraw.');
    }

    const totalAmount = eligiblePayouts.reduce((sum, p) => sum + p.netAmount, 0);

    const batch = await this.prisma.$transaction(async (tx) => {
      const newBatch = await tx.payoutBatch.create({
        data: {
          driverId,
          type: 'MANUAL_FREE',
          status: 'PENDING',
          totalAmount: Math.round(totalAmount * 100) / 100,
          feeAmount: 0,
          netPayoutAmount: Math.round(totalAmount * 100) / 100,
        },
      });

      for (const payout of eligiblePayouts) {
        await tx.payoutBatchItem.create({
          data: { batchId: newBatch.id, driverPayoutId: payout.id, amount: payout.netAmount },
        });
        await tx.driverPayout.update({
          where: { id: payout.id },
          data: { status: EnumDriverPayoutStatus.PAID, paidAt: new Date() },
        });
      }

      return newBatch;
    });

    this.logger.log(`Free withdrawal batch ${batch.id} for driver ${driverId}: $${totalAmount.toFixed(2)}`);
    await this.processBatchTransfer(batch);
    return batch;
  }

  /**
   * Request an instant payout.
   * Collects all ELIGIBLE payouts, deducts $1.50 fee, pays immediately via Stripe.
   * Any amount >= $5. Arrives in minutes.
   */
  async requestInstantPayout(driverId: string): Promise<any> {
    const availableBalance = await this.getDriverAvailableBalance(driverId);

    if (availableBalance < this.MIN_INSTANT_PAYOUT) {
      throw new BadRequestException(
        `Minimum instant payout is $${this.MIN_INSTANT_PAYOUT}. Current balance: $${availableBalance.toFixed(2)}`,
      );
    }

    const existingPending = await this.prisma.payoutBatch.findFirst({
      where: { driverId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending withdrawal. Please wait for it to complete.',
      );
    }

    const eligiblePayouts = await this.prisma.driverPayout.findMany({
      where: { driverId, status: EnumDriverPayoutStatus.ELIGIBLE },
      select: { id: true, netAmount: true },
    });

    if (eligiblePayouts.length === 0) {
      throw new BadRequestException('No eligible payouts to withdraw.');
    }

    const totalAmount = eligiblePayouts.reduce((sum, p) => sum + p.netAmount, 0);
    const feeAmount = this.INSTANT_FEE;
    const netPayoutAmount = Math.max(0, totalAmount - feeAmount);

    const batch = await this.prisma.$transaction(async (tx) => {
      const newBatch = await tx.payoutBatch.create({
        data: {
          driverId,
          type: 'INSTANT',
          status: 'PENDING',
          totalAmount: Math.round(totalAmount * 100) / 100,
          feeAmount,
          netPayoutAmount: Math.round(netPayoutAmount * 100) / 100,
        },
      });

      for (const payout of eligiblePayouts) {
        await tx.payoutBatchItem.create({
          data: { batchId: newBatch.id, driverPayoutId: payout.id, amount: payout.netAmount },
        });
        await tx.driverPayout.update({
          where: { id: payout.id },
          data: { status: EnumDriverPayoutStatus.PAID, paidAt: new Date() },
        });
      }

      return newBatch;
    });

    this.logger.log(
      `Instant payout batch ${batch.id} for driver ${driverId}: $${totalAmount.toFixed(2)} (fee: $${feeAmount.toFixed(2)}, net: $${netPayoutAmount.toFixed(2)})`,
    );
    await this.processBatchInstantPayout(batch);
    return batch;
  }

  /**
   * Process weekly auto-payouts. Call via cron every Sunday.
   * Only processes drivers with $50+ available balance.
   */
  async processWeeklyAutoPayouts(): Promise<{ processed: number; skipped: number }> {
    const driversWithBalance = await this.prisma.driverPayout.groupBy({
      by: ['driverId'],
      where: { status: EnumDriverPayoutStatus.ELIGIBLE },
      _sum: { netAmount: true },
      having: { netAmount: { _sum: { gte: this.MIN_FREE_WITHDRAWAL } } },
    });

    let processed = 0;
    let skipped = 0;

    for (const driver of driversWithBalance) {
      const existingPending = await this.prisma.payoutBatch.findFirst({
        where: { driverId: driver.driverId, status: 'PENDING' },
      });
      if (existingPending) { skipped++; continue; }

      try {
        const eligiblePayouts = await this.prisma.driverPayout.findMany({
          where: { driverId: driver.driverId, status: EnumDriverPayoutStatus.ELIGIBLE },
          select: { id: true, netAmount: true },
        });

        const totalAmount = eligiblePayouts.reduce((sum, p) => sum + p.netAmount, 0);

        const batch = await this.prisma.$transaction(async (tx) => {
          const newBatch = await tx.payoutBatch.create({
            data: {
              driverId: driver.driverId, type: 'WEEKLY_AUTO', status: 'PENDING',
              totalAmount: Math.round(totalAmount * 100) / 100, feeAmount: 0,
              netPayoutAmount: Math.round(totalAmount * 100) / 100,
            },
          });

          for (const payout of eligiblePayouts) {
            await tx.payoutBatchItem.create({
              data: { batchId: newBatch.id, driverPayoutId: payout.id, amount: payout.netAmount },
            });
            await tx.driverPayout.update({
              where: { id: payout.id },
              data: { status: EnumDriverPayoutStatus.PAID, paidAt: new Date() },
            });
          }
          return newBatch;
        });

        await this.processBatchTransfer(batch);
        processed++;
      } catch (err: any) {
        this.logger.error(`Weekly auto-payout failed for driver ${driver.driverId}: ${err.message}`);
        skipped++;
      }
    }

    this.logger.log(`Weekly auto-payouts: ${processed} processed, ${skipped} skipped`);
    return { processed, skipped };
  }

  /**
   * Process a standard (free) transfer via Stripe Connect.
   */
  private async processBatchTransfer(batch: any): Promise<void> {
    if (!this.stripeService) {
      this.logger.warn('StripeService not available — batch remains PENDING');
      return;
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: batch.driverId },
      select: { stripeConnectAccountId: true, stripeConnectOnboardingComplete: true },
    });

    if (!driver?.stripeConnectAccountId || !driver.stripeConnectOnboardingComplete) {
      this.logger.warn(`Driver ${batch.driverId} has no Stripe Connect — batch ${batch.id} remains PENDING`);
      return;
    }

    try {
      await this.prisma.payoutBatch.update({ where: { id: batch.id }, data: { status: 'PROCESSING' } });

      const transfer = await this.stripeService.createTransfer({
        amount: batch.netPayoutAmount,
        destinationAccountId: driver.stripeConnectAccountId,
        transferGroup: batch.id,
        metadata: { batchId: batch.id, driverId: batch.driverId, type: batch.type },
      });

      await this.prisma.payoutBatch.update({
        where: { id: batch.id },
        data: { status: 'COMPLETED', stripeTransferId: transfer.id, completedAt: new Date() },
      });
    } catch (err: any) {
      await this.prisma.payoutBatch.update({
        where: { id: batch.id },
        data: { status: 'FAILED', failureMessage: err.message || 'Unknown error', failedAt: new Date() },
      });
    }
  }

  /**
   * Process an instant payout via Stripe Connect.
   */
  private async processBatchInstantPayout(batch: any): Promise<void> {
    if (!this.stripeService) {
      this.logger.warn('StripeService not available — batch remains PENDING');
      return;
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: batch.driverId },
      select: { stripeConnectAccountId: true, stripeConnectOnboardingComplete: true },
    });

    if (!driver?.stripeConnectAccountId || !driver.stripeConnectOnboardingComplete) {
      this.logger.warn(`Driver ${batch.driverId} has no Stripe Connect — batch ${batch.id} remains PENDING`);
      return;
    }

    try {
      await this.prisma.payoutBatch.update({ where: { id: batch.id }, data: { status: 'PROCESSING' } });

      const payout = await this.stripeService.createInstantPayout({
        amount: batch.netPayoutAmount,
        destinationAccountId: driver.stripeConnectAccountId,
        method: 'instant',
        metadata: { batchId: batch.id, driverId: batch.driverId, type: 'INSTANT', fee: String(batch.feeAmount) },
      });

      await this.prisma.payoutBatch.update({
        where: { id: batch.id },
        data: { status: 'COMPLETED', stripePayoutId: payout.id, completedAt: new Date() },
      });
    } catch (err: any) {
      await this.prisma.payoutBatch.update({
        where: { id: batch.id },
        data: { status: 'FAILED', failureMessage: err.message || 'Unknown error', failedAt: new Date() },
      });
    }
  }

  /**
   * Get a driver's withdrawal/batch history.
   */
  async getDriverPayoutBatches(driverId: string) {
    return this.prisma.payoutBatch.findMany({
      where: { driverId },
      orderBy: { initiatedAt: 'desc' },
      include: {
        payoutItems: {
          include: {
            driverPayout: {
              select: {
                id: true, netAmount: true,
                delivery: { select: { id: true, serviceType: true, pickupAddress: true, dropoffAddress: true } },
              },
            },
          },
        },
      },
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

  // ── Driver Withdrawal / Payout Methods ──────────────────────────

  private readonly MIN_FREE_WITHDRAWAL = 50;  // $50 minimum for free/manual payout
  private readonly INSTANT_FEE = 1.5;          // $1.50 fee for instant payout
  private readonly AUTO_PAYOUT_DAY = 0;        // 0 = Sunday

  /**
   * Request a free (manual) withdrawal.
   * Requirements: $50 minimum balance, Stripe Connect account must be set up.
   * Timeline: 1-2 business days (standard Stripe transfer).
   */
  async requestFreeWithdrawal(driverId: string): Promise<{
    success: boolean;
    message: string;
    payoutIds: string[];
    totalAmount: number;
  }> {
    // Validate Stripe Connect account
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectOnboardingComplete: true,
      },
    });

    if (!driver?.stripeConnectAccountId || !driver.stripeConnectOnboardingComplete) {
      throw new BadRequestException(
        'Stripe Connect account is not set up. Please complete Stripe onboarding before requesting a withdrawal.',
      );
    }

    // Calculate total available balance
    const eligiblePayouts = await this.prisma.driverPayout.findMany({
      where: {
        driverId,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAvailable = eligiblePayouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);

    if (totalAvailable < this.MIN_FREE_WITHDRAWAL) {
      throw new BadRequestException(
        `Minimum withdrawal amount is $${this.MIN_FREE_WITHDRAWAL}. Your available balance is $${totalAvailable.toFixed(2)}.`,
      );
    }

    // Mark all eligible payouts as PROCESSING and initiate Stripe transfers
    const payoutIds: string[] = [];
    let transferredAmount = 0;

    for (const payout of eligiblePayouts) {
      try {
        if (!this.stripeService) {
          this.logger.error('StripeService not available — cannot initiate withdrawal transfer');
          throw new BadRequestException('Payout service is temporarily unavailable. Please try again later.');
        }

        const transfer = await this.stripeService.createTransfer({
          amount: payout.netAmount,
          destinationAccountId: driver.stripeConnectAccountId,
          transferGroup: `withdrawal-${driverId}-${Date.now()}`,
          metadata: {
            driverId,
            payoutId: payout.id,
            deliveryId: payout.deliveryId,
            type: 'free_withdrawal',
          },
        });

        await this.prisma.driverPayout.update({
          where: { id: payout.id },
          data: {
            status: EnumDriverPayoutStatus.PAID,
            providerTransferId: transfer.id,
            paidAt: new Date(),
          },
        });

        payoutIds.push(payout.id);
        transferredAmount += payout.netAmount;
      } catch (err: any) {
        this.logger.error(
          `Free withdrawal transfer failed for payout ${payout.id}: ${err.message}`,
        );
        throw new BadRequestException(
          `Transfer failed: ${err.message}. Please try again later.`,
        );
      }
    }

    this.logger.log(
      `Free withdrawal processed for driver ${driverId}: ${payoutIds.length} payouts, $${transferredAmount.toFixed(2)} total`,
    );

    return {
      success: true,
      message: `$${transferredAmount.toFixed(2)} is on its way! Expected arrival: 1-2 business days.`,
      payoutIds,
      totalAmount: transferredAmount,
    };
  }

  /**
   * Request an instant payout with a fee.
   * No minimum balance required. $1.50 fee deducted from the transfer.
   * Timeline: minutes (Stripe instant payout).
   */
  async requestInstantPayout(driverId: string): Promise<{
    success: boolean;
    message: string;
    payoutIds: string[];
    totalGross: number;
    fee: number;
    netTransferred: number;
  }> {
    // Validate Stripe Connect account
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        stripeConnectAccountId: true,
        stripeConnectOnboardingComplete: true,
      },
    });

    if (!driver?.stripeConnectAccountId || !driver.stripeConnectOnboardingComplete) {
      throw new BadRequestException(
        'Stripe Connect account is not set up. Please complete Stripe onboarding before requesting an instant payout.',
      );
    }

    // Calculate total available balance
    const eligiblePayouts = await this.prisma.driverPayout.findMany({
      where: {
        driverId,
        status: EnumDriverPayoutStatus.ELIGIBLE,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAvailable = eligiblePayouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);

    if (totalAvailable <= 0) {
      throw new BadRequestException('No earnings available for payout.');
    }

    // Deduct the instant fee from the total
    const netTransferred = Math.max(totalAvailable - this.INSTANT_FEE, 0);

    // Use Stripe payout API for instant payout (faster than transfer)
    // Stripe Connect Express: payout to connected account's bank
    if (!this.stripeService) {
      this.logger.error('StripeService not available — cannot initiate instant payout');
      throw new BadRequestException('Payout service is temporarily unavailable. Please try again later.');
    }

    try {
      // Create individual transfers for each payout record for traceability
      const payoutIds: string[] = [];
      let totalTransferred = 0;

      for (const payout of eligiblePayouts) {
        const transfer = await this.stripeService.createTransfer({
          amount: payout.netAmount,
          destinationAccountId: driver.stripeConnectAccountId,
          transferGroup: `instant-${driverId}-${Date.now()}`,
          metadata: {
            driverId,
            payoutId: payout.id,
            deliveryId: payout.deliveryId,
            type: 'instant_payout',
            fee: this.INSTANT_FEE,
          },
        });

        await this.prisma.driverPayout.update({
          where: { id: payout.id },
          data: {
            status: EnumDriverPayoutStatus.PAID,
            providerTransferId: transfer.id,
            paidAt: new Date(),
          },
        });

        payoutIds.push(payout.id);
        totalTransferred += payout.netAmount;
      }

      this.logger.log(
        `Instant payout processed for driver ${driverId}: ${payoutIds.length} payouts, $${totalTransferred.toFixed(2)} gross, $${this.INSTANT_FEE.toFixed(2)} fee`,
      );

      return {
        success: true,
        message: `$${netTransferred.toFixed(2)} sent instantly! ($${this.INSTANT_FEE.toFixed(2)} fee deducted).`,
        payoutIds,
        totalGross: totalAvailable,
        fee: this.INSTANT_FEE,
        netTransferred,
      };
    } catch (err: any) {
      this.logger.error(`Instant payout failed for driver ${driverId}: ${err.message}`);
      throw new BadRequestException(
        `Instant payout failed: ${err.message}. Please try again later.`,
      );
    }
  }

  /**
   * Process weekly auto-payout.
   * Should be called by a cron job on Sundays.
   * Collects all ELIGIBLE payouts >= $50 total per driver and initiates transfers.
   */
  async processWeeklyAutoPayout(): Promise<{
    driversProcessed: number;
    totalTransferred: number;
    details: Array<{ driverId: string; payoutCount: number; amount: number }>;
  }> {
    if (!this.stripeService) {
      this.logger.error('StripeService not available — weekly auto-payout skipped');
      return { driversProcessed: 0, totalTransferred: 0, details: [] };
    }

    // Find all drivers with eligible payouts totaling >= $50
    const eligiblePayouts = await this.prisma.driverPayout.findMany({
      where: { status: EnumDriverPayoutStatus.ELIGIBLE },
      include: {
        driver: {
          select: {
            id: true,
            stripeConnectAccountId: true,
            stripeConnectOnboardingComplete: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by driver
    const byDriver = new Map<string, typeof eligiblePayouts>();
    for (const p of eligiblePayouts) {
      if (!p.driver?.stripeConnectAccountId || !p.driver.stripeConnectOnboardingComplete) {
        continue; // Skip drivers without Stripe Connect
      }
      const list = byDriver.get(p.driverId) || [];
      list.push(p);
      byDriver.set(p.driverId, list);
    }

    const details: Array<{ driverId: string; payoutCount: number; amount: number }> = [];
    let totalTransferred = 0;

    for (const [driverId, payouts] of byDriver) {
      const total = payouts.reduce((sum, p) => sum + (p.netAmount || 0), 0);

      // Only process if total >= $50
      if (total < this.MIN_FREE_WITHDRAWAL) {
        this.logger.debug(
          `Skipping driver ${driverId}: total $${total.toFixed(2)} < $${this.MIN_FREE_WITHDRAWAL} minimum`,
        );
        continue;
      }

      const driver = payouts[0].driver!;

      try {
        let driverTotal = 0;
        for (const payout of payouts) {
          const transfer = await this.stripeService.createTransfer({
            amount: payout.netAmount,
            destinationAccountId: driver.stripeConnectAccountId,
            transferGroup: `weekly-${driverId}-${Date.now()}`,
            metadata: {
              driverId,
              payoutId: payout.id,
              deliveryId: payout.deliveryId,
              type: 'weekly_auto',
            },
          });

          await this.prisma.driverPayout.update({
            where: { id: payout.id },
            data: {
              status: EnumDriverPayoutStatus.PAID,
              providerTransferId: transfer.id,
              paidAt: new Date(),
            },
          });

          driverTotal += payout.netAmount;
        }

        details.push({ driverId, payoutCount: payouts.length, amount: driverTotal });
        totalTransferred += driverTotal;

        this.logger.log(
          `Weekly auto-payout: driver ${driverId} — ${payouts.length} payouts, $${driverTotal.toFixed(2)}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Weekly auto-payout failed for driver ${driverId}: ${err.message}`,
        );
        // Continue with next driver
      }
    }

    this.logger.log(
      `Weekly auto-payout complete: ${details.length} drivers, $${totalTransferred.toFixed(2)} total`,
    );

    return {
      driversProcessed: details.length,
      totalTransferred,
      details,
    };
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

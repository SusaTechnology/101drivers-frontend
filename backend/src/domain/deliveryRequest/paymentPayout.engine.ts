import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumDriverPayoutStatus,
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentPaymentType,
  EnumPaymentStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type Tx = Prisma.TransactionClient;

@Injectable()
export class PaymentPayoutEngine {
  constructor(private readonly prisma: PrismaService) {}

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

    const payment = delivery.payment;
    if (!payment) {
      return;
    }

    if (payment.paymentType === EnumPaymentPaymentType.PREPAID) {
      if (payment.status === EnumPaymentStatus.AUTHORIZED) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: EnumPaymentStatus.CAPTURED,
            capturedAt: new Date(),
          },
        });

        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            type: EnumPaymentEventType.CAPTURE,
            status: EnumPaymentEventStatus.CAPTURED,
            amount: payment.amount,
            message: "Prepaid payment captured at delivery completion",
            raw: {
              source: "delivery-complete",
              deliveryId: input.deliveryId,
              actorUserId: input.actorUserId ?? null,
            },
          },
        });
      } else if (
        payment.status !== EnumPaymentStatus.CAPTURED &&
        payment.status !== EnumPaymentStatus.PAID
      ) {
        throw new BadRequestException(
          "Prepaid payment is not in a capturable state"
        );
      }
    }

    const freshPayment = await tx.payment.findUnique({
      where: { id: payment.id },
      select: {
        id: true,
        amount: true,
        paymentType: true,
        status: true,
      },
    });

    if (!freshPayment) {
      throw new NotFoundException("Payment not found after update");
    }

    const tipAmount =
      delivery.tip &&
      ["AUTHORIZED", "CAPTURED"].includes(delivery.tip.status)
        ? Number((delivery.tip.amount ?? 0).toFixed(2))
        : 0;

    const breakdown = this.computeBreakdown({
      amount:
        freshPayment.amount ??
        delivery.quote?.estimatedPrice ??
        0,
      pricingSnapshot: delivery.quote?.pricingSnapshot ?? null,
      feesBreakdown: delivery.quote?.feesBreakdown ?? null,
      tipAmount,
    });

    const payoutStatus =
      freshPayment.paymentType === EnumPaymentPaymentType.POSTPAID &&
      freshPayment.status !== EnumPaymentStatus.INVOICED &&
      freshPayment.status !== EnumPaymentStatus.PAID
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
}

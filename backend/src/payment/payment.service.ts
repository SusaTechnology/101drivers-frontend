// src/payment/payment.service.ts

import { Injectable, Logger, Inject, Optional, BadRequestException } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  Payment as PrismaPayment,
  PaymentEvent as PrismaPaymentEvent,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PaymentServiceBase } from "./base/payment.service.base";
import { PaymentDomain } from "../domain/payment/payment.domain";
import { PaymentPolicyService } from "../domain/payment/paymentPolicy.service";
import { PaymentPayoutEngine } from "../domain/deliveryRequest/paymentPayout.engine";
import { StripeService } from "../providers/stripe/stripe.service";
import { NotFoundException } from "@nestjs/common";
import { EnumPaymentStatus, EnumPaymentEventType, Prisma as PrismaClientNS } from "@prisma/client";
@Injectable()
export class PaymentService extends PaymentServiceBase {
  private readonly logger = new Logger(PaymentService.name);

constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: PaymentDomain,
  private readonly policy: PaymentPolicyService,
  private readonly paymentPayoutEngine: PaymentPayoutEngine,
  @Optional() @Inject(StripeService)
  private readonly stripeService?: StripeService,
) {
  super(prisma);
}

  async count(args: Omit<Prisma.PaymentCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.payment.count(args);
  }

  async payments(args: Prisma.PaymentFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async payment(args: Prisma.PaymentFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPayment(args: Prisma.PaymentCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.payment.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePayment(args: Prisma.PaymentUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.payment.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePayment(args: Prisma.PaymentDeleteArgs): Promise<PrismaPayment> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.payment.delete(args);
  }

  async findEvents(
    parentId: string,
    args: Prisma.PaymentEventFindManyArgs
  ): Promise<PrismaPaymentEvent[]> {
    return this.prisma.payment
      .findUniqueOrThrow({ where: { id: parentId } })
      .events(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.payment
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  private normalizeCreateData(
    data: Prisma.PaymentCreateArgs["data"]
  ): Prisma.PaymentCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.invoiceId = this.trimOptionalString(normalized.invoiceId);
    normalized.providerChargeId = this.trimOptionalString(normalized.providerChargeId);
    normalized.providerPaymentIntentId = this.trimOptionalString(
      normalized.providerPaymentIntentId
    );
    normalized.failureCode = this.trimOptionalString(normalized.failureCode);
    normalized.failureMessage = this.trimOptionalString(normalized.failureMessage);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.PaymentUpdateArgs["data"]
  ): Prisma.PaymentUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "invoiceId");
    this.normalizeUpdateStringField(normalized, "providerChargeId");
    this.normalizeUpdateStringField(normalized, "providerPaymentIntentId");
    this.normalizeUpdateStringField(normalized, "failureCode");
    this.normalizeUpdateStringField(normalized, "failureMessage");

    return normalized;
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.trimOptionalString(raw.set),
      };
      return;
    }

    target[field] = this.trimOptionalString(raw);
  }

  async getAdminPayments(input: {
  status?: string | null;
  statuses?: string | null;
  paymentType?: string | null;
  provider?: string | null;
  customerId?: string | null;
  deliveryId?: string | null;
  from?: Date | null;
  to?: Date | null;
  invoicedOnly?: boolean;
  unpaidOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<any> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 20, 100));
  const skip = (page - 1) * pageSize;

  // `statuses` (comma-separated) is an OR-union across several statuses —
  // used by the "Failed Only" quick filter to cover both CHARGE_FAILED
  // (postpaid weekly-invoice failures) and FAILED (prepaid failures) at
  // once. Takes precedence over the single `status` exact filter.
  const statusList = input.statuses
    ? input.statuses
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Status-related conditions are AND-ed via `AND` so they can never
  // overwrite each other (the old spread-order let `unpaidOnly`'s
  // status.notIn silently replace an explicit `status` filter).
  const statusConditions: Prisma.PaymentWhereInput[] = [];
  if (statusList.length > 0) {
    statusConditions.push({ status: { in: statusList as any } });
  } else if (input.status) {
    statusConditions.push({ status: input.status as any });
  }
  if (input.unpaidOnly === true) {
    statusConditions.push({
      status: {
        notIn: [EnumPaymentStatus.PAID, EnumPaymentStatus.REFUNDED] as any,
      },
    });
  }

  const where: Prisma.PaymentWhereInput = {
    ...(input.paymentType ? { paymentType: input.paymentType as any } : {}),
    ...(input.provider ? { provider: input.provider as any } : {}),
    ...(input.deliveryId ? { deliveryId: input.deliveryId } : {}),
    ...(input.customerId
      ? {
          delivery: {
            customerId: input.customerId,
          },
        }
      : {}),
    ...(input.invoicedOnly === true
      ? { invoiceId: { not: null } }
      : {}),
    ...(statusConditions.length > 0 ? { AND: statusConditions } : {}),
    ...((input.from || input.to)
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };

  const [count, items] = await Promise.all([
    this.prisma.payment.count({ where }),
    this.domain.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        invoiceId: true,
        authorizedAt: true,
        capturedAt: true,
        paidAt: true,
        voidedAt: true,
        refundedAt: true,
        failureCode: true,
        failureMessage: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        createdAt: true,
        updatedAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            customerId: true,
            pickupAddress: true,
            dropoffAddress: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                businessName: true,
                contactName: true,
                contactEmail: true,
              },
            },
            payout: {
              select: {
                id: true,
                status: true,
                netAmount: true,
                paidAt: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            message: true,
            providerRef: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return {
    items,
    count,
    page,
    pageSize,
    filtersApplied: {
      status: input.status ?? null,
      statuses: input.statuses ?? null,
      paymentType: input.paymentType ?? null,
      provider: input.provider ?? null,
      customerId: input.customerId ?? null,
      deliveryId: input.deliveryId ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
      invoicedOnly: input.invoicedOnly === true,
      unpaidOnly: input.unpaidOnly === true,
    },
  };
}

/**
 * Fleet-wide status totals for the admin payments page KPI cards —
 * computed with ONE groupBy query over the whole period, NOT from the
 * paginated list rows.
 *
 * Why this endpoint exists: the KPI cards used to count statuses across
 * only the CURRENT PAGE of the list (20 rows), so the numbers jumped
 * around every time an admin clicked a card or changed filters —
 * "summary shows 2 failed, click it, now it shows 20". The cards must
 * show the real period totals ("the exact number of the month"), stay
 * stable no matter what is clicked, and be cheap to query.
 *
 * Period: defaults to the current calendar month (server time). The page
 * forwards its date-range filters when set, so the cards and the list
 * always describe the same window.
 */
async getAdminPaymentSummary(input: {
  from?: Date | null;
  to?: Date | null;
}): Promise<any> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = input.from ?? monthStart;
  const to = input.to ?? now;
  const usesDefaultPeriod = !input.from && !input.to;

  const groups = await this.prisma.payment.groupBy({
    by: ["status"],
    where: { createdAt: { gte: from, lte: to } },
    _count: true,
    _sum: { amount: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;
  let totalAmount = 0;
  for (const g of groups) {
    counts[g.status] = g._count;
    total += g._count;
    totalAmount += Number(g._sum.amount ?? 0);
  }

  const failedTotal =
    (counts["CHARGE_FAILED"] ?? 0) + (counts["FAILED"] ?? 0);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    usesDefaultPeriod,
    counts,
    total,
    totalAmount: Math.round(totalAmount * 100) / 100,
    failedTotal,
  };
}

/**
 * Fetch a single payment by ID with full detail for the admin payment-detail
 * page. Includes the associated delivery, customer, payout, and ALL payment
 * events (vs. the list endpoint which only returns the latest 5 events).
 */
async getAdminPaymentDetail(paymentId: string): Promise<any> {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      paymentType: true,
      provider: true,
      status: true,
      invoiceId: true,
      authorizedAt: true,
      capturedAt: true,
      paidAt: true,
      voidedAt: true,
      refundedAt: true,
      failureCode: true,
      failureMessage: true,
      failedAt: true,
      providerChargeId: true,
      providerPaymentIntentId: true,
      lockInAmount: true,
      stripeInvoiceId: true,
      stripeInvoiceItemId: true,
      attemptCount: true,
      // ── Refund tracking fields (Fix #5) ──
      refundedAmountCents: true,
      refundStatus: true,
      // ── Dispute tracking (Fix #3) ──
      disputeId: true,
      disputeStatus: true,
      createdAt: true,
      updatedAt: true,
      delivery: {
        select: {
          id: true,
          status: true,
          serviceType: true,
          customerId: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupWindowStart: true,
          pickupWindowEnd: true,
          dropoffWindowStart: true,
          dropoffWindowEnd: true,
          pickupPin: true,
          customer: {
            select: {
              id: true,
              userId: true,  // Needed so the admin payment detail can link to /admin-user-detail/$userId
              customerType: true,
              businessName: true,
              contactName: true,
              contactEmail: true,
            },
          },
          assignments: {
            where: { unassignedAt: null },
            take: 1,
            select: {
              id: true,
              driverId: true,
              assignedAt: true,
              driver: {
                select: {
                  id: true,
                  status: true,
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          payout: {
            select: {
              id: true,
              status: true,
              netAmount: true,
              paidAt: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          message: true,
          providerRef: true,
          createdAt: true,
        },
      },
    },
  });

  if (!payment) {
    throw new NotFoundException(`Payment ${paymentId} not found`);
  }

  return payment;
}

async adminMarkPaymentPaid(input: {
  paymentId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<any> {
  const payment = await this.prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      deliveryId: true,
    },
  });

  if (!payment) {
    throw new NotFoundException("Payment not found");
  }

  await this.paymentPayoutEngine.adminMarkPostpaidPaid({
    deliveryId: payment.deliveryId,
    actorUserId: input.actorUserId ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.paymentId });
}

async adminMarkPayoutPaidByPayment(input: {
  paymentId: string;
  actorUserId?: string | null;
  providerTransferId?: string | null;
  note?: string | null;
}): Promise<any> {
  const payment = await this.prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      deliveryId: true,
    },
  });

  if (!payment) {
    throw new NotFoundException("Payment not found");
  }

  await this.paymentPayoutEngine.adminMarkPayoutPaid({
    deliveryId: payment.deliveryId,
    actorUserId: input.actorUserId ?? null,
    providerTransferId:
      this.trimOptionalString(input.providerTransferId) ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.paymentId });
}
async adminMarkPaymentInvoiced(input: {
  paymentId: string;
  actorUserId?: string | null;
  invoiceId?: string | null;
  note?: string | null;
}): Promise<any> {
  const payment = await this.prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      deliveryId: true,
    },
  });

  if (!payment) {
    throw new NotFoundException("Payment not found");
  }

  await this.paymentPayoutEngine.adminInvoicePostpaid({
    deliveryId: payment.deliveryId,
    actorUserId: input.actorUserId ?? null,
    invoiceId: this.trimOptionalString(input.invoiceId) ?? null,
    note: this.trimOptionalString(input.note) ?? null,
  });

  return this.domain.findUnique({ id: input.paymentId });
}

async adminRefundPayment(input: {
  paymentId: string;
  amount?: number | null;
  actorUserId?: string | null;
  reason?: string | null;
  note?: string | null;
}): Promise<any> {
  const payment = await this.prisma.payment.findUnique({
    where: { id: input.paymentId },
  });

  if (!payment) {
    throw new NotFoundException("Payment not found");
  }

  // Can only refund CAPTURED or PAID payments
  if (
    payment.status !== EnumPaymentStatus.CAPTURED &&
    payment.status !== EnumPaymentStatus.PAID
  ) {
    throw new BadRequestException(
      `Cannot refund payment in status ${payment.status}. Only CAPTURED or PAID payments can be refunded.`,
    );
  }

  // Process Stripe refund if provider is STRIPE and charge exists
  if (payment.provider === "STRIPE" && payment.providerChargeId && this.stripeService) {
    try {
      await this.stripeService.createRefund({
        chargeId: payment.providerChargeId,
        amount: input.amount ?? undefined, // omit = full refund
        reason: input.reason || "requested_by_admin",
      });
      this.logger.log(
        `Stripe refund processed for payment ${payment.id}` +
          (input.amount ? ` ($${input.amount})` : " (full)"),
      );
    } catch (err: any) {
      this.logger.error(`Stripe refund failed for payment ${payment.id}: ${err.message}`);
      throw new BadRequestException(`Stripe refund failed: ${err.message}`);
    }
  } else if (!payment.providerChargeId && payment.provider === "STRIPE") {
    throw new BadRequestException(
      "No Stripe charge found on this payment. Cannot process refund via Stripe.",
    );
  }
  // Non-STRIPE providers: just update the DB status (manual/offline refund)

  const isFullRefund = !input.amount || input.amount >= payment.amount;

  await this.prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: isFullRefund ? EnumPaymentStatus.REFUNDED : EnumPaymentStatus.CAPTURED,
        refundedAt: new Date(),
      },
    });

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: EnumPaymentEventType.REFUND,
        status: EnumPaymentStatus.REFUNDED,
        amount: input.amount ?? payment.amount,
        message: input.note || (isFullRefund ? "Full refund processed by admin" : `Partial refund ($${input.amount}) processed by admin`),
        raw: {
          source: "admin-refund",
          actorUserId: input.actorUserId ?? null,
          reason: input.reason ?? null,
        },
      },
    });
  });

  return this.domain.findUnique({ id: input.paymentId });
}
}
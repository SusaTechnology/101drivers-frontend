// src/payment/payment.service.ts

import { Injectable } from "@nestjs/common";
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
import { NotFoundException } from "@nestjs/common";
import { EnumPaymentStatus, Prisma as PrismaClientNS } from "@prisma/client";
@Injectable()
export class PaymentService extends PaymentServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: PaymentDomain,
  private readonly policy: PaymentPolicyService,
  private readonly paymentPayoutEngine: PaymentPayoutEngine
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

  const where: Prisma.PaymentWhereInput = {
    ...(input.status ? { status: input.status as any } : {}),
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
    ...(input.unpaidOnly === true
      ? {
          status: {
            notIn: [EnumPaymentStatus.PAID, EnumPaymentStatus.REFUNDED] as any,
          },
        }
      : {}),
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
}
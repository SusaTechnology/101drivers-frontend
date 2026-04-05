// src/domain/payment/payment.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type PaymentSelect = Prisma.PaymentSelect;
type PaymentWhere = Prisma.PaymentWhereInput;
type PaymentWhereUnique = Prisma.PaymentWhereUniqueInput;
type PaymentFindMany = Prisma.PaymentFindManyArgs;
type PaymentFindUnique = Prisma.PaymentFindUniqueArgs;

@Injectable()
export class PaymentDomain extends BaseDomain<
  PaymentSelect,
  PaymentWhere,
  PaymentWhereUnique,
  PaymentFindMany,
  PaymentFindUnique
> {
  protected enrichSelectFields: PaymentSelect = {
    id: true,
    deliveryId: true,
    amount: true,
    paymentType: true,
    provider: true,
    status: true,
    invoiceId: true,
    providerChargeId: true,
    providerPaymentIntentId: true,
    failureCode: true,
    failureMessage: true,
    authorizedAt: true,
    capturedAt: true,
    paidAt: true,
    failedAt: true,
    voidedAt: true,
    refundedAt: true,
    createdAt: true,
    updatedAt: true,

    delivery: {
      select: {
        id: true,
        status: true,
        serviceType: true,
        customerId: true,
        quoteId: true,
        sameDayEligible: true,
        requiresOpsConfirmation: true,
        afterHours: true,
        isUrgent: true,
        createdAt: true,
        updatedAt: true,
      },
    },

    events: {
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        providerRef: true,
        message: true,
        raw: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    },

    _count: {
      select: {
        events: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.payment);
  }
}
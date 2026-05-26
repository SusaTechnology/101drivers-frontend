// src/domain/paymentEvent/paymentEvent.domain.ts

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BaseDomain } from "../_shared/base.domain";

type PaymentEventSelect = Prisma.PaymentEventSelect;
type PaymentEventWhere = Prisma.PaymentEventWhereInput;
type PaymentEventWhereUnique = Prisma.PaymentEventWhereUniqueInput;
type PaymentEventFindMany = Prisma.PaymentEventFindManyArgs;
type PaymentEventFindUnique = Prisma.PaymentEventFindUniqueArgs;

@Injectable()
export class PaymentEventDomain extends BaseDomain<
  PaymentEventSelect,
  PaymentEventWhere,
  PaymentEventWhereUnique,
  PaymentEventFindMany,
  PaymentEventFindUnique
> {
  protected enrichSelectFields: PaymentEventSelect = {
    id: true,
    paymentId: true,
    type: true,
    status: true,
    amount: true,
    providerRef: true,
    message: true,
    raw: true,
    createdAt: true,
    updatedAt: true,

    payment: {
      select: {
        id: true,
        deliveryId: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        invoiceId: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        authorizedAt: true,
        capturedAt: true,
        paidAt: true,
        failedAt: true,
        voidedAt: true,
        refundedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {
    super(prisma.paymentEvent);
  }
}
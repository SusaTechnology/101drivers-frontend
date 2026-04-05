// src/paymentEvent/paymentEvent.service.ts

import { Injectable } from "@nestjs/common";
import {
  Payment as PrismaPayment,
  PaymentEvent as PrismaPaymentEvent,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { PaymentEventServiceBase } from "./base/paymentEvent.service.base";
import { PaymentEventDomain } from "../domain/paymentEvent/paymentEvent.domain";
import { PaymentEventPolicyService } from "../domain/paymentEvent/paymentEventPolicy.service";

@Injectable()
export class PaymentEventService extends PaymentEventServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: PaymentEventDomain,
    private readonly policy: PaymentEventPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.PaymentEventCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.paymentEvent.count(args);
  }

  async paymentEvents(args: Prisma.PaymentEventFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async paymentEvent(args: Prisma.PaymentEventFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createPaymentEvent(args: Prisma.PaymentEventCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.paymentEvent.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updatePaymentEvent(args: Prisma.PaymentEventUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.paymentEvent.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deletePaymentEvent(
    args: Prisma.PaymentEventDeleteArgs
  ): Promise<PrismaPaymentEvent> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.paymentEvent.delete(args);
  }

  async getPayment(parentId: string): Promise<PrismaPayment | null> {
    return this.prisma.paymentEvent
      .findUnique({ where: { id: parentId } })
      .payment();
  }

  private normalizeCreateData(
    data: Prisma.PaymentEventCreateArgs["data"]
  ): Prisma.PaymentEventCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.providerRef = this.trimOptionalString(normalized.providerRef);
    normalized.message = this.trimOptionalString(normalized.message);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.PaymentEventUpdateArgs["data"]
  ): Prisma.PaymentEventUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "providerRef");
    this.normalizeUpdateStringField(normalized, "message");

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
}
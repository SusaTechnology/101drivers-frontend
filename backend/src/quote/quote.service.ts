// src/quote/quote.service.ts
import { Injectable } from "@nestjs/common";
import {
  Prisma,
  Quote as PrismaQuote,
  DeliveryRequest as PrismaDeliveryRequest,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { QuoteServiceBase } from "./base/quote.service.base";
import { QuoteDomain } from "../domain/quote/quote.domain";
import { QuotePolicyService } from "../domain/quote/quotePolicy.service";

@Injectable()
export class QuoteService extends QuoteServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: QuoteDomain,
    private readonly policy: QuotePolicyService
  ) {
    super(prisma);
  }

  async count(args: Omit<Prisma.QuoteCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.quote.count(args);
  }

  async quotes(args: Prisma.QuoteFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async quote(args: Prisma.QuoteFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createQuote(args: Prisma.QuoteCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.quote.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateQuote(args: Prisma.QuoteUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.quote.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteQuote(args: Prisma.QuoteDeleteArgs): Promise<PrismaQuote> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.quote.delete(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.quote
      .findUnique({
        where: { id: parentId },
      })
      .delivery();
  }

  private normalizeCreateData(data: Prisma.QuoteCreateInput): Prisma.QuoteCreateInput {
    const normalized: any = { ...data };

    normalized.pickupAddress = this.trimRequiredString(normalized.pickupAddress);
    normalized.dropoffAddress = this.trimRequiredString(normalized.dropoffAddress);

    normalized.pickupPlaceId = this.trimOptionalString(normalized.pickupPlaceId);
    normalized.dropoffPlaceId = this.trimOptionalString(normalized.dropoffPlaceId);

    normalized.pickupState = this.normalizeOptionalState(normalized.pickupState);
    normalized.dropoffState = this.normalizeOptionalState(normalized.dropoffState);

    normalized.routePolyline = this.trimOptionalString(normalized.routePolyline);

    return normalized;
  }

  private normalizeUpdateData(data: Prisma.QuoteUpdateInput): Prisma.QuoteUpdateInput {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "pickupAddress", true);
    this.normalizeUpdateStringField(normalized, "dropoffAddress", true);

    this.normalizeUpdateStringField(normalized, "pickupPlaceId", false);
    this.normalizeUpdateStringField(normalized, "dropoffPlaceId", false);

    this.normalizeUpdateStateField(normalized, "pickupState");
    this.normalizeUpdateStateField(normalized, "dropoffState");

    this.normalizeUpdateStringField(normalized, "routePolyline", false);

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim();
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalState(value: unknown): string | null | undefined {
    const stripped = this.trimOptionalString(value);

    if (typeof stripped !== "string") {
      return stripped as any;
    }

    return stripped.toUpperCase();
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string,
    required: boolean
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      const normalized = required
        ? this.trimRequiredString(raw.set)
        : this.trimOptionalString(raw.set);

      target[field] = { ...raw, set: normalized };
      return;
    }

    target[field] = required
      ? this.trimRequiredString(raw)
      : this.trimOptionalString(raw);
  }

  private normalizeUpdateStateField(
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
        set: this.normalizeOptionalState(raw.set),
      };
      return;
    }

    target[field] = this.normalizeOptionalState(raw);
  }
}
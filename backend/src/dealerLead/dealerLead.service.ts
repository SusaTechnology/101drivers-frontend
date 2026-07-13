// src/dealerLead/dealerLead.service.ts

import { Injectable } from "@nestjs/common";
import {
  DealerLead as PrismaDealerLead,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DealerLeadServiceBase } from "./base/dealerLead.service.base";
import { DealerLeadDomain } from "../domain/dealerLead/dealerLead.domain";
import { DealerLeadPolicyService } from "../domain/dealerLead/dealerLeadPolicy.service";

@Injectable()
export class DealerLeadService extends DealerLeadServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DealerLeadDomain,
    private readonly policy: DealerLeadPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DealerLeadCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.dealerLead.count(args);
  }

  async dealerLeads(args: Prisma.DealerLeadFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async dealerLead(args: Prisma.DealerLeadFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDealerLead(args: Prisma.DealerLeadCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.dealerLead.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDealerLead(args: Prisma.DealerLeadUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.dealerLead.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDealerLead(
    args: Prisma.DealerLeadDeleteArgs
  ): Promise<PrismaDealerLead> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.dealerLead.delete(args);
  }

  private normalizeCreateData(
    data: Prisma.DealerLeadCreateArgs["data"]
  ): Prisma.DealerLeadCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.businessName = this.trimRequiredString(normalized.businessName);
    normalized.email = this.trimRequiredString(normalized.email).toLowerCase();
    normalized.phone = this.trimOptionalString(normalized.phone);
    normalized.message = this.trimOptionalString(normalized.message);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DealerLeadUpdateArgs["data"]
  ): Prisma.DealerLeadUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "businessName", false, false);
    this.normalizeUpdateStringField(normalized, "email", false, true);
    this.normalizeUpdateStringField(normalized, "phone", true, false);
    this.normalizeUpdateStringField(normalized, "message", true, false);

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

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string,
    allowNull: boolean,
    toLowerCase: boolean
  ): void {
    if (!(field in target)) {
      return;
    }

    const normalizeValue = (value: unknown) => {
      const next = allowNull
        ? this.trimOptionalString(value)
        : this.trimRequiredString(value);

      if (typeof next === "string" && toLowerCase) {
        return next.toLowerCase();
      }

      return next;
    };

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: normalizeValue(raw.set),
      };
      return;
    }

    target[field] = normalizeValue(raw);
  }
}
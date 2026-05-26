// src/investorLead/investorLead.service.ts

import { Injectable } from "@nestjs/common";
import {
  InvestorLead as PrismaInvestorLead,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { InvestorLeadServiceBase } from "./base/investorLead.service.base";
import { InvestorLeadDomain } from "../domain/investorLead/investorLead.domain";
import { InvestorLeadPolicyService } from "../domain/investorLead/investorLeadPolicy.service";

@Injectable()
export class InvestorLeadService extends InvestorLeadServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: InvestorLeadDomain,
    private readonly policy: InvestorLeadPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.InvestorLeadCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.investorLead.count(args);
  }

  async investorLeads(args: Prisma.InvestorLeadFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async investorLead(args: Prisma.InvestorLeadFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createInvestorLead(args: Prisma.InvestorLeadCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.investorLead.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateInvestorLead(args: Prisma.InvestorLeadUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.investorLead.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  } 

  async deleteInvestorLead(
    args: Prisma.InvestorLeadDeleteArgs
  ): Promise<PrismaInvestorLead> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.investorLead.delete(args);
  }

  private normalizeCreateData(
    data: Prisma.InvestorLeadCreateArgs["data"]
  ): Prisma.InvestorLeadCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.name = this.trimRequiredString(normalized.name);
    normalized.email = this.trimRequiredString(normalized.email).toLowerCase();
    normalized.message = this.trimOptionalString(normalized.message);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.InvestorLeadUpdateArgs["data"]
  ): Prisma.InvestorLeadUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "name", false, false);
    this.normalizeUpdateStringField(normalized, "email", false, true);
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
// src/deliveryCompliance/deliveryCompliance.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryCompliance as PrismaDeliveryCompliance,
  DeliveryRequest as PrismaDeliveryRequest,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DeliveryComplianceServiceBase } from "./base/deliveryCompliance.service.base";
import { DeliveryComplianceDomain } from "../domain/deliveryCompliance/deliveryCompliance.domain";
import { DeliveryCompliancePolicyService } from "../domain/deliveryCompliance/deliveryCompliancePolicy.service";

@Injectable()
export class DeliveryComplianceService extends DeliveryComplianceServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DeliveryComplianceDomain,
    private readonly policy: DeliveryCompliancePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DeliveryComplianceCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.deliveryCompliance.count(args);
  }

  async deliveryCompliances(args: Prisma.DeliveryComplianceFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async deliveryCompliance(args: Prisma.DeliveryComplianceFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDeliveryCompliance(args: Prisma.DeliveryComplianceCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.deliveryCompliance.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDeliveryCompliance(args: Prisma.DeliveryComplianceUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.deliveryCompliance.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDeliveryCompliance(
    args: Prisma.DeliveryComplianceDeleteArgs
  ): Promise<PrismaDeliveryCompliance> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.deliveryCompliance.delete(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.deliveryCompliance
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getVerifiedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.deliveryCompliance
      .findUnique({ where: { id: parentId } })
      .verifiedBy();
  }

  private normalizeCreateData(
    data: Prisma.DeliveryComplianceCreateArgs["data"]
  ): Prisma.DeliveryComplianceCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.vinVerificationCode = this.trimOptionalString(normalized.vinVerificationCode);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DeliveryComplianceUpdateArgs["data"]
  ): Prisma.DeliveryComplianceUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "vinVerificationCode");

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
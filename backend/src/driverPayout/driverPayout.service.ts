// src/driverPayout/driverPayout.service.ts

import { Injectable } from "@nestjs/common";
import {
  DeliveryRequest as PrismaDeliveryRequest,
  Driver as PrismaDriver,
  DriverPayout as PrismaDriverPayout,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverPayoutServiceBase } from "./base/driverPayout.service.base";
import { DriverPayoutDomain } from "../domain/driverPayout/driverPayout.domain";
import { DriverPayoutPolicyService } from "../domain/driverPayout/driverPayoutPolicy.service";

@Injectable()
export class DriverPayoutService extends DriverPayoutServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverPayoutDomain,
    private readonly policy: DriverPayoutPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DriverPayoutCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.driverPayout.count(args);
  }

  async driverPayouts(args: Prisma.DriverPayoutFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driverPayout(args: Prisma.DriverPayoutFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriverPayout(args: Prisma.DriverPayoutCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driverPayout.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriverPayout(args: Prisma.DriverPayoutUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driverPayout.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriverPayout(
    args: Prisma.DriverPayoutDeleteArgs
  ): Promise<PrismaDriverPayout> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driverPayout.delete(args);
  }

  async getDelivery(parentId: string): Promise<PrismaDeliveryRequest | null> {
    return this.prisma.driverPayout
      .findUnique({ where: { id: parentId } })
      .delivery();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.driverPayout
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DriverPayoutCreateArgs["data"]
  ): Prisma.DriverPayoutCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.providerTransferId = this.trimOptionalString(normalized.providerTransferId);
    normalized.failureMessage = this.trimOptionalString(normalized.failureMessage);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DriverPayoutUpdateArgs["data"]
  ): Prisma.DriverPayoutUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "providerTransferId");
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
}
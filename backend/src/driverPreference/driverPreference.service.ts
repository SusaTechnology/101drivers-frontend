// src/driverPreference/driverPreference.service.ts

import { Injectable } from "@nestjs/common";
import {
  Driver as PrismaDriver,
  DriverPreference as PrismaDriverPreference,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverPreferenceServiceBase } from "./base/driverPreference.service.base";
import { DriverPreferenceDomain } from "../domain/driverPreference/driverPreference.domain";
import { DriverPreferencePolicyService } from "../domain/driverPreference/driverPreferencePolicy.service";

@Injectable()
export class DriverPreferenceService extends DriverPreferenceServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverPreferenceDomain,
    private readonly policy: DriverPreferencePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DriverPreferenceCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.driverPreference.count(args);
  }

  async driverPreferences(args: Prisma.DriverPreferenceFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driverPreference(args: Prisma.DriverPreferenceFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriverPreference(args: Prisma.DriverPreferenceCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driverPreference.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriverPreference(args: Prisma.DriverPreferenceUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driverPreference.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriverPreference(
    args: Prisma.DriverPreferenceDeleteArgs
  ): Promise<PrismaDriverPreference> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driverPreference.delete(args);
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.driverPreference
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DriverPreferenceCreateArgs["data"]
  ): Prisma.DriverPreferenceCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.city = this.trimOptionalString(normalized.city);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DriverPreferenceUpdateArgs["data"]
  ): Prisma.DriverPreferenceUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "city");

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
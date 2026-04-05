// src/driverAlertPreference/driverAlertPreference.service.ts

import { Injectable } from "@nestjs/common";
import {
  Driver as PrismaDriver,
  DriverAlertPreference as PrismaDriverAlertPreference,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverAlertPreferenceServiceBase } from "./base/driverAlertPreference.service.base";
import { DriverAlertPreferenceDomain } from "../domain/driverAlertPreference/driverAlertPreference.domain";
import { DriverAlertPreferencePolicyService } from "../domain/driverAlertPreference/driverAlertPreferencePolicy.service";

@Injectable()
export class DriverAlertPreferenceService extends DriverAlertPreferenceServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverAlertPreferenceDomain,
    private readonly policy: DriverAlertPreferencePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DriverAlertPreferenceCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.driverAlertPreference.count(args);
  }

  async driverAlertPreferences(
    args: Prisma.DriverAlertPreferenceFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driverAlertPreference(
    args: Prisma.DriverAlertPreferenceFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriverAlertPreference(
    args: Prisma.DriverAlertPreferenceCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driverAlertPreference.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriverAlertPreference(
    args: Prisma.DriverAlertPreferenceUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driverAlertPreference.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriverAlertPreference(
    args: Prisma.DriverAlertPreferenceDeleteArgs
  ): Promise<PrismaDriverAlertPreference> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driverAlertPreference.delete(args);
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.driverAlertPreference
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DriverAlertPreferenceCreateArgs["data"]
  ): Prisma.DriverAlertPreferenceCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.DriverAlertPreferenceUpdateArgs["data"]
  ): Prisma.DriverAlertPreferenceUpdateArgs["data"] {
    return { ...data };
  }
}
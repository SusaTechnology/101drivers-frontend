// src/driverDistrictPreference/driverDistrictPreference.service.ts

import { Injectable } from "@nestjs/common";
import {
  Driver as PrismaDriver,
  DriverDistrictPreference as PrismaDriverDistrictPreference,
  Prisma,
  ServiceDistrict as PrismaServiceDistrict,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverDistrictPreferenceServiceBase } from "./base/driverDistrictPreference.service.base";
import { DriverDistrictPreferenceDomain } from "../domain/driverDistrictPreference/driverDistrictPreference.domain";
import { DriverDistrictPreferencePolicyService } from "../domain/driverDistrictPreference/driverDistrictPreferencePolicy.service";

@Injectable()
export class DriverDistrictPreferenceService extends DriverDistrictPreferenceServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverDistrictPreferenceDomain,
    private readonly policy: DriverDistrictPreferencePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DriverDistrictPreferenceCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.driverDistrictPreference.count(args);
  }

  async driverDistrictPreferences(
    args: Prisma.DriverDistrictPreferenceFindManyArgs
  ): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driverDistrictPreference(
    args: Prisma.DriverDistrictPreferenceFindUniqueArgs
  ): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriverDistrictPreference(
    args: Prisma.DriverDistrictPreferenceCreateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driverDistrictPreference.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriverDistrictPreference(
    args: Prisma.DriverDistrictPreferenceUpdateArgs
  ): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driverDistrictPreference.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriverDistrictPreference(
    args: Prisma.DriverDistrictPreferenceDeleteArgs
  ): Promise<PrismaDriverDistrictPreference> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driverDistrictPreference.delete(args);
  }

  async getDistrict(parentId: string): Promise<PrismaServiceDistrict | null> {
    return this.prisma.driverDistrictPreference
      .findUnique({ where: { id: parentId } })
      .district();
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.driverDistrictPreference
      .findUnique({ where: { id: parentId } })
      .driver();
  }

  private normalizeCreateData(
    data: Prisma.DriverDistrictPreferenceCreateArgs["data"]
  ): Prisma.DriverDistrictPreferenceCreateArgs["data"] {
    return { ...data };
  }

  private normalizeUpdateData(
    data: Prisma.DriverDistrictPreferenceUpdateArgs["data"]
  ): Prisma.DriverDistrictPreferenceUpdateArgs["data"] {
    return { ...data };
  }
}
// src/serviceDistrict/serviceDistrict.service.ts

import { Injectable } from "@nestjs/common";
import {
  DriverDistrictPreference as PrismaDriverDistrictPreference,
  Prisma,
  ServiceDistrict as PrismaServiceDistrict,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { ServiceDistrictServiceBase } from "./base/serviceDistrict.service.base";
import { ServiceDistrictDomain } from "../domain/serviceDistrict/serviceDistrict.domain";
import { ServiceDistrictPolicyService } from "../domain/serviceDistrict/serviceDistrictPolicy.service";

@Injectable()
export class ServiceDistrictService extends ServiceDistrictServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: ServiceDistrictDomain,
    private readonly policy: ServiceDistrictPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.ServiceDistrictCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.serviceDistrict.count(args);
  }

  async serviceDistricts(args: Prisma.ServiceDistrictFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async serviceDistrict(args: Prisma.ServiceDistrictFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createServiceDistrict(args: Prisma.ServiceDistrictCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.serviceDistrict.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateServiceDistrict(args: Prisma.ServiceDistrictUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.serviceDistrict.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteServiceDistrict(
    args: Prisma.ServiceDistrictDeleteArgs
  ): Promise<PrismaServiceDistrict> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.serviceDistrict.delete(args);
  }

  async findDriverPrefs(
    parentId: string,
    args: Prisma.DriverDistrictPreferenceFindManyArgs
  ): Promise<PrismaDriverDistrictPreference[]> {
    return this.prisma.serviceDistrict
      .findUniqueOrThrow({ where: { id: parentId } })
      .driverPrefs(args);
  }

  private normalizeCreateData(
    data: Prisma.ServiceDistrictCreateArgs["data"]
  ): Prisma.ServiceDistrictCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.code = this.trimRequiredString(normalized.code).toUpperCase();
    normalized.name = this.trimRequiredString(normalized.name);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.ServiceDistrictUpdateArgs["data"]
  ): Prisma.ServiceDistrictUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateCodeField(normalized, "code");
    this.normalizeUpdateStringField(normalized, "name");

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim();
  }

  private normalizeUpdateCodeField(
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
        set: this.trimRequiredString(raw.set).toUpperCase(),
      };
      return;
    }

    target[field] = this.trimRequiredString(raw).toUpperCase();
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
        set: this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = this.trimRequiredString(raw);
  }
}
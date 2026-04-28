import { Injectable } from "@nestjs/common";
import {
  DriverLocation as PrismaDriverLocation,
  Driver as PrismaDriver,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverLocationServiceBase } from "./base/driverLocation.service.base";
import { DriverLocationDomain } from "../domain/driverLocation/driverLocation.domain";
import { DriverLocationPolicyService } from "../domain/driverLocation/driverLocationPolicy.service";

@Injectable()
export class DriverLocationService extends DriverLocationServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverLocationDomain,
    private readonly policy: DriverLocationPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.DriverLocationCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.driverLocation.count(args);
  }

  async driverLocations(args: Prisma.DriverLocationFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driverLocation(args: Prisma.DriverLocationFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriverLocation(args: Prisma.DriverLocationCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driverLocation.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriverLocation(args: Prisma.DriverLocationUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driverLocation.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriverLocation(
    args: Prisma.DriverLocationDeleteArgs
  ): Promise<PrismaDriverLocation> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driverLocation.delete(args);
  }

  async getDriver(parentId: string): Promise<PrismaDriver | null> {
    return this.prisma.driverLocation.findUnique({ where: { id: parentId } }).driver();
  }

  private normalizeCreateData(
    data: Prisma.DriverLocationCreateArgs["data"]
  ): Prisma.DriverLocationCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.homeBaseCity = this.trimOptionalString(normalized.homeBaseCity);
    normalized.homeBaseState = this.normalizeOptionalState(normalized.homeBaseState);

    normalized.currentLat = this.normalizeOptionalNumber(normalized.currentLat);
    normalized.currentLng = this.normalizeOptionalNumber(normalized.currentLng);
    normalized.homeBaseLat = this.normalizeOptionalNumber(normalized.homeBaseLat);
    normalized.homeBaseLng = this.normalizeOptionalNumber(normalized.homeBaseLng);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DriverLocationUpdateArgs["data"]
  ): Prisma.DriverLocationUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "homeBaseCity");
    this.normalizeUpdateStateField(normalized, "homeBaseState");

    this.normalizeUpdateNumberField(normalized, "currentLat");
    this.normalizeUpdateNumberField(normalized, "currentLng");
    this.normalizeUpdateNumberField(normalized, "homeBaseLat");
    this.normalizeUpdateNumberField(normalized, "homeBaseLng");

    return normalized;
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalState(value: unknown): string | null | undefined {
    const trimmed = this.trimOptionalString(value);
    if (typeof trimmed !== "string") {
      return trimmed as any;
    }

    return trimmed.toUpperCase();
  }

  private normalizeOptionalNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (value as any);
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

  private normalizeUpdateNumberField(
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
        set: this.normalizeOptionalNumber(raw.set),
      };
      return;
    }

    target[field] = this.normalizeOptionalNumber(raw);
  }
}

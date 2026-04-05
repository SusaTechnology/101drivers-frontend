// src/savedVehicle/savedVehicle.service.ts

import { Injectable } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  Prisma,
  SavedVehicle as PrismaSavedVehicle,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { SavedVehicleServiceBase } from "./base/savedVehicle.service.base";
import { SavedVehicleDomain } from "../domain/savedVehicle/savedVehicle.domain";
import { SavedVehiclePolicyService } from "../domain/savedVehicle/savedVehiclePolicy.service";
import { stripEmptyObjectsDeep } from "../domain/common/policy/utils/stripEmptyObjectsDeep.util";

@Injectable()
export class SavedVehicleService extends SavedVehicleServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: SavedVehicleDomain,
    private readonly policy: SavedVehiclePolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.SavedVehicleCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.savedVehicle.count(args);
  }

  async savedVehicles(args: Prisma.SavedVehicleFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async savedVehicle(args: Prisma.SavedVehicleFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createSavedVehicle(args: Prisma.SavedVehicleCreateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeCreateData(args.data)
    ) as Prisma.SavedVehicleCreateArgs["data"];

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.savedVehicle.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateSavedVehicle(args: Prisma.SavedVehicleUpdateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeUpdateData(args.data)
    ) as Prisma.SavedVehicleUpdateArgs["data"];

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.savedVehicle.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteSavedVehicle(
    args: Prisma.SavedVehicleDeleteArgs
  ): Promise<PrismaSavedVehicle> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.savedVehicle.delete(args);
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.savedVehicle
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  private normalizeCreateData(
    data: Prisma.SavedVehicleCreateArgs["data"]
  ): Prisma.SavedVehicleCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.licensePlate = this.trimRequiredString(normalized.licensePlate);
    normalized.color = this.trimRequiredString(normalized.color);
    normalized.make = this.trimOptionalString(normalized.make);
    normalized.model = this.trimOptionalString(normalized.model);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.SavedVehicleUpdateArgs["data"]
  ): Prisma.SavedVehicleUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "licensePlate", false);
    this.normalizeUpdateStringField(normalized, "color", false);
    this.normalizeUpdateStringField(normalized, "make", true);
    this.normalizeUpdateStringField(normalized, "model", true);

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
    allowNull: boolean
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: allowNull
          ? this.trimOptionalString(raw.set)
          : this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = allowNull
      ? this.trimOptionalString(raw)
      : this.trimRequiredString(raw);
  }
}
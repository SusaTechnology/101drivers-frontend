// src/savedAddress/savedAddress.service.ts

import { Injectable } from "@nestjs/common";
import {
  Customer as PrismaCustomer,
  Prisma,
  SavedAddress as PrismaSavedAddress,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { SavedAddressServiceBase } from "./base/savedAddress.service.base";
import { SavedAddressDomain } from "../domain/savedAddress/savedAddress.domain";
import { SavedAddressPolicyService } from "../domain/savedAddress/savedAddressPolicy.service";
import { stripEmptyObjectsDeep } from "../domain/common/policy/utils/stripEmptyObjectsDeep.util";

@Injectable()
export class SavedAddressService extends SavedAddressServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: SavedAddressDomain,
    private readonly policy: SavedAddressPolicyService
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.SavedAddressCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.savedAddress.count(args);
  }

  async savedAddresses(args: Prisma.SavedAddressFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async savedAddress(args: Prisma.SavedAddressFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createSavedAddress(args: Prisma.SavedAddressCreateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeCreateData(args.data)
    ) as Prisma.SavedAddressCreateArgs["data"];

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.savedAddress.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateSavedAddress(args: Prisma.SavedAddressUpdateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeUpdateData(args.data)
    ) as Prisma.SavedAddressUpdateArgs["data"];

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.savedAddress.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteSavedAddress(
    args: Prisma.SavedAddressDeleteArgs
  ): Promise<PrismaSavedAddress> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.savedAddress.delete(args);
  }

  async findDefaultForCustomers(
    parentId: string,
    args: Prisma.CustomerFindManyArgs
  ): Promise<PrismaCustomer[]> {
    return this.prisma.savedAddress
      .findUniqueOrThrow({ where: { id: parentId } })
      .defaultForCustomers(args);
  }

  async getCustomer(parentId: string): Promise<PrismaCustomer | null> {
    return this.prisma.savedAddress
      .findUnique({ where: { id: parentId } })
      .customer();
  }

  private normalizeCreateData(
    data: Prisma.SavedAddressCreateArgs["data"]
  ): Prisma.SavedAddressCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.label = this.trimRequiredString(normalized.label);
    normalized.address = this.trimRequiredString(normalized.address);
    normalized.city = this.trimRequiredString(normalized.city);
    normalized.state = this.normalizeState(normalized.state);
    normalized.postalCode = this.trimRequiredString(normalized.postalCode);
    normalized.country = this.normalizeCountry(normalized.country);
    normalized.placeId = this.trimRequiredString(normalized.placeId);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.SavedAddressUpdateArgs["data"]
  ): Prisma.SavedAddressUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "label", false);
    this.normalizeUpdateStringField(normalized, "address", false);
    this.normalizeUpdateStringField(normalized, "city", false);
    this.normalizeUpdateStateField(normalized, "state");
    this.normalizeUpdateStringField(normalized, "postalCode", false);
    this.normalizeUpdateCountryField(normalized, "country");
    this.normalizeUpdateStringField(normalized, "placeId", false);

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

  private normalizeState(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim().toUpperCase();
  }

  private normalizeCountry(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }
    return value.trim().toUpperCase();
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
        set: this.normalizeState(raw.set),
      };
      return;
    }

    target[field] = this.normalizeState(raw);
  }

  private normalizeUpdateCountryField(
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
        set: this.normalizeCountry(raw.set),
      };
      return;
    }

    target[field] = this.normalizeCountry(raw);
  }
}
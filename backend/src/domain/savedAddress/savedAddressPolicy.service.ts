// src/domain/savedAddress/savedAddressPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class SavedAddressPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.SavedAddressCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureCustomerProvided(row);
    this.ensureRequiredString(row.address, "address is required");

    this.ensureOptionalString(row.label, "label");
    this.ensureOptionalString(row.city, "city");
    this.ensureOptionalString(row.state, "state");
    this.ensureOptionalString(row.postalCode, "postalCode");
    this.ensureOptionalString(row.country, "country");
    this.ensureOptionalString(row.placeId, "placeId");

    this.validateLatLngIfProvided(row.lat, row.lng);

    if (row.state !== undefined && row.state !== null && String(row.state).trim() !== "") {
      this.validateCaliforniaState(row.state);
    }

    if (row.country !== undefined && row.country !== null && String(row.country).trim() !== "") {
      this.validateCountry(row.country);
    }

    const customerId = this.resolveCustomerId(row);
    if (customerId) {
      await this.ensureCustomerExists(client, customerId);
    }

    if (row.isDefault === true && customerId) {
      await this.ensureNoOtherDefaultAddress(client, customerId);
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.SavedAddressUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "SavedAddress id is required for update");

    const existing = await client.savedAddress.findUnique({
      where: { id: id! },
      select: {
        id: true,
        customerId: true,
        label: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        lat: true,
        lng: true,
        placeId: true,
        isDefault: true,
      },
    });

    this.ensureFound(existing, `SavedAddress '${id}' not found`);

    if ("customer" in (data as any) || "customerId" in (data as any)) {
      throw new AppException(
        "customer relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      label: this.resolveUpdatedValue(data.label, existing!.label),
      address: this.resolveUpdatedValue(data.address, existing!.address),
      city: this.resolveUpdatedValue(data.city, existing!.city),
      state: this.resolveUpdatedValue(data.state, existing!.state),
      postalCode: this.resolveUpdatedValue(data.postalCode, existing!.postalCode),
      country: this.resolveUpdatedValue(data.country, existing!.country),
      lat: this.resolveUpdatedValue(data.lat, existing!.lat),
      lng: this.resolveUpdatedValue(data.lng, existing!.lng),
      placeId: this.resolveUpdatedValue(data.placeId, existing!.placeId),
      isDefault: this.resolveUpdatedValue(data.isDefault, existing!.isDefault),
    };

    this.ensureRequiredString(merged.address, "address is required");

    this.ensureOptionalString(merged.label, "label");
    this.ensureOptionalString(merged.city, "city");
    this.ensureOptionalString(merged.state, "state");
    this.ensureOptionalString(merged.postalCode, "postalCode");
    this.ensureOptionalString(merged.country, "country");
    this.ensureOptionalString(merged.placeId, "placeId");

    this.validateLatLngIfProvided(merged.lat, merged.lng);

    if (merged.state !== undefined && merged.state !== null && String(merged.state).trim() !== "") {
      this.validateCaliforniaState(merged.state);
    }

    if (merged.country !== undefined && merged.country !== null && String(merged.country).trim() !== "") {
      this.validateCountry(merged.country);
    }

    if (merged.isDefault === true && existing!.customerId) {
      await this.ensureNoOtherDefaultAddress(client, existing!.customerId, id!);
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "SavedAddress id is required for delete");

    const existing = await client.savedAddress.findUnique({
      where: { id: id! },
      select: {
        id: true,
        customerId: true,
        isDefault: true,
        _count: {
          select: {
            defaultForCustomers: true,
          },
        },
      },
    });

    this.ensureFound(existing, `SavedAddress '${id}' not found`);

    if (existing!.isDefault || existing!._count.defaultForCustomers > 0) {
      throw new AppException(
        "SavedAddress cannot be deleted because it is used as a default pickup",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureCustomerExists(
    client: PrismaClient,
    customerId: string
  ): Promise<void> {
    const row = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `Customer '${customerId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async ensureNoOtherDefaultAddress(
    client: PrismaClient,
    customerId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.savedAddress.findFirst({
      where: {
        customerId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "Only one default saved address is allowed per customer",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private ensureId(id: string | undefined, message: string): void {
    if (!id) {
      throw new AppException(message, ErrorCodes.INVALID_PARAMS);
    }
  }

  private ensureFound(record: any, message: string): void {
    if (!record) {
      throw new AppException(message, ErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
  }

  private ensureCustomerProvided(row: any): void {
    const hasCheckedRelation = !!row?.customer;
    const hasUncheckedCustomerId =
      typeof row?.customerId === "string" && row.customerId.trim().length > 0;

    if (!hasCheckedRelation && !hasUncheckedCustomerId) {
      throw new AppException(
        "customer is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureOptionalString(value: unknown, fieldName: string): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        `${fieldName} must be a string`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateLatLngIfProvided(lat: unknown, lng: unknown): void {
    const hasLat = lat !== undefined && lat !== null && String(lat) !== "";
    const hasLng = lng !== undefined && lng !== null && String(lng) !== "";

    if (!hasLat && !hasLng) {
      return;
    }

    if (hasLat) {
      const latNum =
        typeof lat === "number" ? lat : typeof lat === "string" ? Number(lat) : NaN;

      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        throw new AppException(
          "lat must be a valid latitude",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    if (hasLng) {
      const lngNum =
        typeof lng === "number" ? lng : typeof lng === "string" ? Number(lng) : NaN;

      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        throw new AppException(
          "lng must be a valid longitude",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }

  private validateCaliforniaState(value: unknown): void {
    if (typeof value !== "string") {
      throw new AppException("state is invalid", ErrorCodes.VALIDATION_ERROR);
    }

    const normalized = value.trim().toUpperCase();
    if (normalized !== "CA" && normalized !== "CALIFORNIA") {
      throw new AppException(
        "state must be CA for the California MVP",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateCountry(value: unknown): void {
    if (typeof value !== "string") {
      throw new AppException("country is invalid", ErrorCodes.VALIDATION_ERROR);
    }

    const normalized = value.trim().toUpperCase();
    if (
      normalized !== "US" &&
      normalized !== "USA" &&
      normalized !== "UNITED STATES" &&
      normalized !== "UNITED STATES OF AMERICA"
    ) {
      throw new AppException(
        "country must be US for the California MVP",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolveCustomerId(row: any): string | undefined {
    if (typeof row?.customerId === "string" && row.customerId.trim().length > 0) {
      return row.customerId.trim();
    }

    if (row?.customer?.connect?.id) {
      return row.customer.connect.id;
    }

    return undefined;
  }

  private resolveUpdatedValue(nextValue: any, currentValue: any): any {
    if (nextValue === undefined) {
      return currentValue;
    }

    if (nextValue && typeof nextValue === "object" && "set" in nextValue) {
      return nextValue.set;
    }

    return nextValue;
  }
}
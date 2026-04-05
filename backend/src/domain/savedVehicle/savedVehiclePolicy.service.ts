// src/domain/savedVehicle/savedVehiclePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class SavedVehiclePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.SavedVehicleCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureCustomerProvided(row);
    this.ensureRequiredString(row.licensePlate, "licensePlate is required");
    this.ensureRequiredString(row.color, "color is required");

    const customerId = this.resolveCustomerId(row);
    if (customerId) {
      await this.ensureCustomerExists(client, customerId);
      await this.ensureUniqueLicensePlateForCustomer(
        client,
        customerId,
        row.licensePlate.trim()
      );
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.SavedVehicleUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "SavedVehicle id is required for update");

    const existing = await client.savedVehicle.findUnique({
      where: { id: id! },
      select: {
        id: true,
        customerId: true,
        licensePlate: true,
        make: true,
        model: true,
        color: true,
      },
    });

    this.ensureFound(existing, `SavedVehicle '${id}' not found`);

    if ("customer" in (data as any) || "customerId" in (data as any)) {
      throw new AppException(
        "customer relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      licensePlate: this.resolveUpdatedValue(data.licensePlate, existing!.licensePlate),
      make: this.resolveUpdatedValue(data.make, existing!.make),
      model: this.resolveUpdatedValue(data.model, existing!.model),
      color: this.resolveUpdatedValue(data.color, existing!.color),
    };

    this.ensureRequiredString(merged.licensePlate, "licensePlate is required");
    this.ensureRequiredString(merged.color, "color is required");

    if (
      typeof merged.licensePlate === "string" &&
      merged.licensePlate.trim() !== existing!.licensePlate
    ) {
      await this.ensureUniqueLicensePlateForCustomer(
        client,
        existing!.customerId,
        merged.licensePlate.trim(),
        id!
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "SavedVehicle id is required for delete");

    const existing = await client.savedVehicle.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `SavedVehicle '${id}' not found`);
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

  private async ensureUniqueLicensePlateForCustomer(
    client: PrismaClient,
    customerId: string,
    licensePlate: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.savedVehicle.findFirst({
      where: {
        customerId,
        licensePlate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "licensePlate already exists for this customer",
        ErrorCodes.DUPLICATE_ENTRY,
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
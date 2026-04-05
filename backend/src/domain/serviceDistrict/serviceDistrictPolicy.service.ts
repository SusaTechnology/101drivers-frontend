// src/domain/serviceDistrict/serviceDistrictPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class ServiceDistrictPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.ServiceDistrictCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureRequiredString(row.code, "code is required");
    this.ensureRequiredString(row.name, "name is required");

    const normalizedCode = String(row.code).trim().toUpperCase();

    await this.ensureUniqueCode(client, normalizedCode);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.ServiceDistrictUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "ServiceDistrict id is required for update");

    const existing = await client.serviceDistrict.findUnique({
      where: { id: id! },
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
      },
    });

    this.ensureFound(existing, `ServiceDistrict '${id}' not found`);

    const merged = {
      code: this.resolveUpdatedValue(data.code, existing!.code),
      name: this.resolveUpdatedValue(data.name, existing!.name),
    };

    this.ensureRequiredString(merged.code, "code is required");
    this.ensureRequiredString(merged.name, "name is required");

    const nextCode = String(merged.code).trim().toUpperCase();
    if (nextCode !== existing!.code) {
      await this.ensureUniqueCode(client, nextCode, id!);
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "ServiceDistrict id is required for delete");

    const existing = await client.serviceDistrict.findUnique({
      where: { id: id! },
      select: {
        id: true,
        _count: {
          select: {
            driverPrefs: true,
          },
        },
      },
    });

    this.ensureFound(existing, `ServiceDistrict '${id}' not found`);

    if (existing!._count.driverPrefs > 0) {
      throw new AppException(
        "ServiceDistrict cannot be deleted because related driver preferences exist",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureUniqueCode(
    client: PrismaClient,
    code: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.serviceDistrict.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "ServiceDistrict code already exists",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
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
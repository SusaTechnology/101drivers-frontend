// src/domain/driverDistrictPreference/driverDistrictPreferencePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDriverStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DriverDistrictPreferencePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DriverDistrictPreferenceCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const driverId = this.resolveRelationId(row.driver, row.driverId);
    if (!driverId) {
      throw new AppException(
        "driver is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const districtId = this.resolveRelationId(row.district, row.districtId);
    if (!districtId) {
      throw new AppException(
        "district is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const driver = await this.ensureDriverExists(client, driverId);
    const district = await this.ensureDistrictExists(client, districtId);

    this.validateDriverAllowed(driver.status);
    this.validateDistrictAllowed(district.active);

    await this.ensureUniqueDriverDistrict(client, driverId, districtId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DriverDistrictPreferenceUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DriverDistrictPreference id is required for update");

    const existing = await client.driverDistrictPreference.findUnique({
      where: { id: id! },
      select: {
        id: true,
        driverId: true,
        districtId: true,
        driver: {
          select: {
            status: true,
          },
        },
        district: {
          select: {
            active: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DriverDistrictPreference '${id}' not found`);

    if ("driver" in (data as any) || "driverId" in (data as any)) {
      throw new AppException(
        "driver relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("district" in (data as any) || "districtId" in (data as any)) {
      throw new AppException(
        "district relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    this.validateDriverAllowed(existing!.driver.status);
    this.validateDistrictAllowed(existing!.district.active);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DriverDistrictPreference id is required for delete");

    const existing = await client.driverDistrictPreference.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DriverDistrictPreference '${id}' not found`);
  }

  private async ensureDriverExists(client: PrismaClient, driverId: string) {
    const row = await client.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!row) {
      throw new AppException(
        `Driver '${driverId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private async ensureDistrictExists(client: PrismaClient, districtId: string) {
    const row = await client.serviceDistrict.findUnique({
      where: { id: districtId },
      select: {
        id: true,
        active: true,
      },
    });

    if (!row) {
      throw new AppException(
        `ServiceDistrict '${districtId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private async ensureUniqueDriverDistrict(
    client: PrismaClient,
    driverId: string,
    districtId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.driverDistrictPreference.findFirst({
      where: {
        driverId,
        districtId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DriverDistrictPreference already exists for this driver and district",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDriverAllowed(status: EnumDriverStatus): void {
    if (
      status !== EnumDriverStatus.PENDING &&
      status !== EnumDriverStatus.APPROVED
    ) {
      throw new AppException(
        "DriverDistrictPreference is not allowed for a suspended driver",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateDistrictAllowed(active: boolean): void {
    if (!active) {
      throw new AppException(
        "DriverDistrictPreference cannot target an inactive district",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolveRelationId(relation: any, scalar: any): string | undefined {
    if (typeof scalar === "string" && scalar.trim().length > 0) {
      return scalar.trim();
    }

    if (relation?.connect?.id) {
      return relation.connect.id;
    }

    return undefined;
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
}
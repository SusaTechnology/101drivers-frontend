// src/domain/driverAlertPreference/driverAlertPreferencePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDriverStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DriverAlertPreferencePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DriverAlertPreferenceCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const driverId = this.resolveDriverId(row);
    if (!driverId) {
      throw new AppException(
        "driver is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const driver = await this.ensureDriverExists(client, driverId);

    this.validateDriverAllowed(driver.status);
    this.validateAlertFlags(row.enabled, row.emailEnabled, row.smsEnabled);

    await this.ensureNoExistingAlertPreferenceForDriver(client, driverId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DriverAlertPreferenceUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DriverAlertPreference id is required for update");

    const existing = await client.driverAlertPreference.findUnique({
      where: { id: id! },
      select: {
        id: true,
        driverId: true,
        enabled: true,
        emailEnabled: true,
        smsEnabled: true,
        driver: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DriverAlertPreference '${id}' not found`);

    if ("driver" in (data as any) || "driverId" in (data as any)) {
      throw new AppException(
        "driver relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      enabled: this.resolveUpdatedValue(data.enabled, existing!.enabled),
      emailEnabled: this.resolveUpdatedValue(data.emailEnabled, existing!.emailEnabled),
      smsEnabled: this.resolveUpdatedValue(data.smsEnabled, existing!.smsEnabled),
    };

    this.validateDriverAllowed(existing!.driver.status);
    this.validateAlertFlags(merged.enabled, merged.emailEnabled, merged.smsEnabled);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DriverAlertPreference id is required for delete");

    const existing = await client.driverAlertPreference.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DriverAlertPreference '${id}' not found`);
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

  private async ensureNoExistingAlertPreferenceForDriver(
    client: PrismaClient,
    driverId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.driverAlertPreference.findFirst({
      where: {
        driverId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DriverAlertPreference already exists for this driver",
        ErrorCodes.CONFLICT,
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
        "DriverAlertPreference is not allowed for a suspended driver",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateAlertFlags(
    enabled: boolean | undefined,
    emailEnabled: boolean | undefined,
    smsEnabled: boolean | undefined
  ): void {
    if (enabled === false) {
      return;
    }

    if (enabled === true && emailEnabled === false && smsEnabled === false) {
      throw new AppException(
        "At least one alert channel must be enabled when enabled is true",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolveDriverId(row: any): string | undefined {
    if (typeof row?.driverId === "string" && row.driverId.trim().length > 0) {
      return row.driverId.trim();
    }

    if (row?.driver?.connect?.id) {
      return row.driver.connect.id;
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
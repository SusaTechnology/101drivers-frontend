import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DriverLocationPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DriverLocationCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const driverId = this.resolveRequiredDriverId(row);
    await this.ensureDriverExists(client, driverId);

    const currentLat = this.resolveCreateNumber(row.currentLat);
    const currentLng = this.resolveCreateNumber(row.currentLng);
    const homeBaseLat = this.resolveCreateNumber(row.homeBaseLat);
    const homeBaseLng = this.resolveCreateNumber(row.homeBaseLng);

    this.validateLatitude(currentLat, "currentLat");
    this.validateLongitude(currentLng, "currentLng");
    this.validateLatitude(homeBaseLat, "homeBaseLat");
    this.validateLongitude(homeBaseLng, "homeBaseLng");

    this.validateCoordinatePair(homeBaseLat, homeBaseLng, "homeBase");
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DriverLocationUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DriverLocation id is required for update");

    const existing = await client.driverLocation.findUnique({
      where: { id: id! },
      select: {
        id: true,
        driverId: true,
        currentLat: true,
        currentLng: true,
        homeBaseLat: true,
        homeBaseLng: true,
      },
    });

    this.ensureFound(existing, `DriverLocation '${id}' not found`);

    const row = data as any;

    const nextDriverId =
      this.resolveConnectedId(row.driver) ?? existing!.driverId;

    await this.ensureDriverExists(client, nextDriverId);

    const currentLat = this.resolveUpdatedValue(row.currentLat, existing!.currentLat);
    const currentLng = this.resolveUpdatedValue(row.currentLng, existing!.currentLng);
    const homeBaseLat = this.resolveUpdatedValue(row.homeBaseLat, existing!.homeBaseLat);
    const homeBaseLng = this.resolveUpdatedValue(row.homeBaseLng, existing!.homeBaseLng);

    this.validateLatitude(currentLat, "currentLat");
    this.validateLongitude(currentLng, "currentLng");
    this.validateLatitude(homeBaseLat, "homeBaseLat");
    this.validateLongitude(homeBaseLng, "homeBaseLng");

    this.validateCoordinatePair(homeBaseLat, homeBaseLng, "homeBase");
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DriverLocation id is required for delete");

    const existing = await client.driverLocation.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DriverLocation '${id}' not found`);
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

  private async ensureDriverExists(
    client: PrismaClient,
    driverId: string
  ): Promise<void> {
    const row = await client.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        "driver not found",
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private resolveRequiredDriverId(row: any): string {
    const connectedId = this.resolveConnectedId(row.driver);
    if (connectedId) {
      return connectedId;
    }

    if (typeof row?.driverId === "string" && row.driverId.trim().length > 0) {
      return row.driverId.trim();
    }

    throw new AppException(
      "driver is required",
      ErrorCodes.VALIDATION_ERROR
    );
  }

  private resolveConnectedId(value: any): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return value.connect?.id;
  }

  private resolveCreateNumber(value: any): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (value as any);
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

  private validateLatitude(value: unknown, label: string): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value < -90 || value > 90) {
      throw new AppException(
        `${label} must be between -90 and 90`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateLongitude(value: unknown, label: string): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value < -180 || value > 180) {
      throw new AppException(
        `${label} must be between -180 and 180`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateCoordinatePair(
    lat: unknown,
    lng: unknown,
    label: string
  ): void {
    const hasLat = lat !== undefined && lat !== null;
    const hasLng = lng !== undefined && lng !== null;

    if (hasLat !== hasLng) {
      throw new AppException(
        `${label}Lat and ${label}Lng must be provided together`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }
}

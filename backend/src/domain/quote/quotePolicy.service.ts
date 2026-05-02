// src/domain/quote/quotePolicy.service.ts
import { Injectable } from "@nestjs/common";
import { HttpStatus } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class QuotePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.QuoteCreateInput
  ): Promise<void> {
    this.validateCreateOrMergedState(data);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.QuoteUpdateInput
  ): Promise<void> {
    this.ensureId(id, "Quote id is required for update");

    const existing = await client.quote.findUnique({
      where: { id: id! },
      select: {
        id: true,
        serviceType: true,
        pricingMode: true,
        mileageCategory: true,

        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupState: true,

        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffState: true,

        distanceMiles: true,
        estimatedPrice: true,
        pricingSnapshot: true,
        routePolyline: true,
      },
    });

    this.ensureFound(existing, `Quote '${id}' not found`);

    const merged = {
      serviceType: this.resolveUpdatedValue(data.serviceType, existing!.serviceType),
      pricingMode: this.resolveUpdatedValue(data.pricingMode, existing!.pricingMode),
      mileageCategory: this.resolveUpdatedValue(
        data.mileageCategory,
        existing!.mileageCategory
      ),

      pickupAddress: this.resolveUpdatedValue(data.pickupAddress, existing!.pickupAddress),
      pickupLat: this.resolveUpdatedValue(data.pickupLat, existing!.pickupLat),
      pickupLng: this.resolveUpdatedValue(data.pickupLng, existing!.pickupLng),
      pickupState: this.resolveUpdatedValue(data.pickupState, existing!.pickupState),

      dropoffAddress: this.resolveUpdatedValue(data.dropoffAddress, existing!.dropoffAddress),
      dropoffLat: this.resolveUpdatedValue(data.dropoffLat, existing!.dropoffLat),
      dropoffLng: this.resolveUpdatedValue(data.dropoffLng, existing!.dropoffLng),
      dropoffState: this.resolveUpdatedValue(data.dropoffState, existing!.dropoffState),

      distanceMiles: this.resolveUpdatedValue(data.distanceMiles, existing!.distanceMiles),
      estimatedPrice: this.resolveUpdatedValue(data.estimatedPrice, existing!.estimatedPrice),
      pricingSnapshot: this.resolveUpdatedValue(
        data.pricingSnapshot,
        existing!.pricingSnapshot
      ),
      routePolyline: this.resolveUpdatedValue(data.routePolyline, existing!.routePolyline),
    };

    this.validateCreateOrMergedState(merged);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "Quote id is required for delete");

    const existing = await client.quote.findUnique({
      where: { id: id! },
      select: {
        id: true,
        delivery: {
          select: {
            id: true,
          },
        },
      },
    });

    this.ensureFound(existing, `Quote '${id}' not found`);

    if (existing!.delivery?.id) {
      throw new AppException(
        "Quote is already linked to a delivery request",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateCreateOrMergedState(data: any): void {
    this.ensureRequiredString(data.pickupAddress, "pickupAddress is required");
    this.ensureRequiredString(data.dropoffAddress, "dropoffAddress is required");

    this.ensureRequiredValue(data.serviceType, "serviceType is required");
    this.ensureRequiredValue(data.pricingMode, "pricingMode is required");

    this.ensureNonNegativeNumber(
      data.distanceMiles,
      "distanceMiles must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      data.estimatedPrice,
      "estimatedPrice must be a non-negative number"
    );

    if (data.pricingSnapshot === undefined || data.pricingSnapshot === null) {
      throw new AppException(
        "pricingSnapshot is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.validateLatLngPair(data.pickupLat, data.pickupLng, "pickup");
    this.validateLatLngPair(data.dropoffLat, data.dropoffLng, "dropoff");

    this.validateCaliforniaState(data.pickupState, "pickupState");
    this.validateCaliforniaState(data.dropoffState, "dropoffState");

    if (data.mileageCategory && data.pricingMode !== "CATEGORY_ABC") {
      throw new AppException(
        "mileageCategory is only allowed when pricingMode is CATEGORY_ABC",
        ErrorCodes.BUSINESS_RULE_VIOLATION
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

  private ensureRequiredValue(value: unknown, message: string): void {
    if (value === undefined || value === null || value === "") {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureNonNegativeNumber(value: unknown, message: string): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

    if (!Number.isFinite(num) || num < 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private validateLatLngPair(
    lat: unknown,
    lng: unknown,
    prefix: "pickup" | "dropoff"
  ): void {
    const hasLat = lat !== undefined && lat !== null;
    const hasLng = lng !== undefined && lng !== null;

    if (hasLat !== hasLng) {
      throw new AppException(
        `${prefix}Lat and ${prefix}Lng must both be provided together`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!hasLat && !hasLng) {
      return;
    }

    const latNum =
      typeof lat === "number" ? lat : typeof lat === "string" ? Number(lat) : NaN;
    const lngNum =
      typeof lng === "number" ? lng : typeof lng === "string" ? Number(lng) : NaN;

    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      throw new AppException(
        `${prefix}Lat must be a valid latitude`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new AppException(
        `${prefix}Lng must be a valid longitude`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateCaliforniaState(value: unknown, field: string): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        `${field} must be a valid state value`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const normalized = value.trim().toUpperCase();

    if (normalized !== "CA" && normalized !== "CALIFORNIA") {
      throw new AppException(
        `${field} must be CA for the California MVP`,
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
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
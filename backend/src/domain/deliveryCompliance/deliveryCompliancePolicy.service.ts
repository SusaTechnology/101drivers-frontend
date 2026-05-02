// src/domain/deliveryCompliance/deliveryCompliancePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryCompliancePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryComplianceCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const deliveryId = this.resolveDeliveryId(row);
    if (!deliveryId) {
      throw new AppException(
        "delivery is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const delivery = await this.ensureDeliveryExists(client, deliveryId);

    this.ensureOptionalNonNegativeInteger(
      row.odometerStart,
      "odometerStart must be a non-negative integer"
    );
    this.ensureOptionalNonNegativeInteger(
      row.odometerEnd,
      "odometerEnd must be a non-negative integer"
    );

    this.validateComplianceDates(
      row.pickupCompletedAt,
      row.dropoffCompletedAt
    );
    this.validateOdometerRange(row.odometerStart, row.odometerEnd);
    this.validateVerificationFields(
      row.verifiedBy,
      row.verifiedByUserId,
      row.verifiedByAdminAt
    );

    if (row.vinConfirmed === true) {
      this.ensureRequiredString(
        row.vinVerificationCode,
        "vinVerificationCode is required when vinConfirmed is true"
      );

      if (
        delivery.vinVerificationCode &&
        row.vinVerificationCode !== delivery.vinVerificationCode
      ) {
        throw new AppException(
          "vinVerificationCode must match the delivery request",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (row.verifiedBy?.connect?.id || row.verifiedByUserId) {
      const verifiedByUserId = this.resolveUserId(row.verifiedBy, row.verifiedByUserId);
      if (verifiedByUserId) {
        await this.ensureUserExists(client, verifiedByUserId, "verifiedBy");
      }
    }

    this.validateDeliveryAllowsCompliance(delivery.status);
    await this.ensureNoExistingComplianceForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DeliveryComplianceUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DeliveryCompliance id is required for update");

    const existing = await client.deliveryCompliance.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        vinConfirmed: true,
        vinVerificationCode: true,
        odometerStart: true,
        odometerEnd: true,
        pickupCompletedAt: true,
        dropoffCompletedAt: true,
        verifiedByUserId: true,
        verifiedByAdminAt: true,
        delivery: {
          select: {
            status: true,
            vinVerificationCode: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DeliveryCompliance '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      vinConfirmed: this.resolveUpdatedValue(data.vinConfirmed, existing!.vinConfirmed),
      vinVerificationCode: this.resolveUpdatedValue(
        data.vinVerificationCode,
        existing!.vinVerificationCode
      ),
      odometerStart: this.resolveUpdatedValue(data.odometerStart, existing!.odometerStart),
      odometerEnd: this.resolveUpdatedValue(data.odometerEnd, existing!.odometerEnd),
      pickupCompletedAt: this.resolveUpdatedValue(
        data.pickupCompletedAt,
        existing!.pickupCompletedAt
      ),
      dropoffCompletedAt: this.resolveUpdatedValue(
        data.dropoffCompletedAt,
        existing!.dropoffCompletedAt
      ),
      verifiedByAdminAt: this.resolveUpdatedValue(
        data.verifiedByAdminAt,
        existing!.verifiedByAdminAt
      ),
    };

    this.ensureOptionalNonNegativeInteger(
      merged.odometerStart,
      "odometerStart must be a non-negative integer"
    );
    this.ensureOptionalNonNegativeInteger(
      merged.odometerEnd,
      "odometerEnd must be a non-negative integer"
    );

    this.validateComplianceDates(
      merged.pickupCompletedAt,
      merged.dropoffCompletedAt
    );
    this.validateOdometerRange(merged.odometerStart, merged.odometerEnd);
    this.validateVerificationFields(
      (data as any).verifiedBy,
      undefined,
      merged.verifiedByAdminAt
    );

    if (merged.vinConfirmed === true) {
      this.ensureRequiredString(
        merged.vinVerificationCode,
        "vinVerificationCode is required when vinConfirmed is true"
      );

      if (
        existing!.delivery.vinVerificationCode &&
        merged.vinVerificationCode !== existing!.delivery.vinVerificationCode
      ) {
        throw new AppException(
          "vinVerificationCode must match the delivery request",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    const nextVerifiedByUserId = this.resolveUserId(
      (data as any).verifiedBy,
      (data as any).verifiedByUserId
    );
    if (nextVerifiedByUserId) {
      await this.ensureUserExists(client, nextVerifiedByUserId, "verifiedBy");
    }

    this.validateDeliveryAllowsCompliance(existing!.delivery.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryCompliance id is required for delete");

    const existing = await client.deliveryCompliance.findUnique({
      where: { id: id! },
      select: {
        id: true,
        pickupCompletedAt: true,
        dropoffCompletedAt: true,
        verifiedByAdminAt: true,
      },
    });

    this.ensureFound(existing, `DeliveryCompliance '${id}' not found`);

    if (
      existing!.pickupCompletedAt ||
      existing!.dropoffCompletedAt ||
      existing!.verifiedByAdminAt
    ) {
      throw new AppException(
        "Verified or completed delivery compliance cannot be deleted",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureDeliveryExists(client: PrismaClient, deliveryId: string) {
    const row = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        vinVerificationCode: true,
      },
    });

    if (!row) {
      throw new AppException(
        `DeliveryRequest '${deliveryId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private async ensureUserExists(
    client: PrismaClient,
    userId: string,
    label: string
  ): Promise<void> {
    const row = await client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `${label} user not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async ensureNoExistingComplianceForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.deliveryCompliance.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DeliveryCompliance already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsCompliance(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.QUOTED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "DeliveryCompliance is not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateComplianceDates(
    pickupCompletedAt: Date | string | null | undefined,
    dropoffCompletedAt: Date | string | null | undefined
  ): void {
    if (!pickupCompletedAt && !dropoffCompletedAt) {
      return;
    }

    if (pickupCompletedAt) {
      const pickupDate = new Date(pickupCompletedAt as any);
      if (Number.isNaN(pickupDate.getTime())) {
        throw new AppException(
          "pickupCompletedAt is invalid",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    if (dropoffCompletedAt) {
      const dropoffDate = new Date(dropoffCompletedAt as any);
      if (Number.isNaN(dropoffDate.getTime())) {
        throw new AppException(
          "dropoffCompletedAt is invalid",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    if (pickupCompletedAt && dropoffCompletedAt) {
      const pickupDate = new Date(pickupCompletedAt as any);
      const dropoffDate = new Date(dropoffCompletedAt as any);

      if (dropoffDate < pickupDate) {
        throw new AppException(
          "dropoffCompletedAt cannot be earlier than pickupCompletedAt",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }

  private validateOdometerRange(
    odometerStart: number | null | undefined,
    odometerEnd: number | null | undefined
  ): void {
    if (
      odometerStart !== undefined &&
      odometerStart !== null &&
      odometerEnd !== undefined &&
      odometerEnd !== null
    ) {
      if (odometerEnd < odometerStart) {
        throw new AppException(
          "odometerEnd cannot be smaller than odometerStart",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }

  private validateVerificationFields(
    verifiedBy: any,
    verifiedByUserId: string | undefined,
    verifiedByAdminAt: Date | string | null | undefined
  ): void {
    const resolvedUserId = this.resolveUserId(verifiedBy, verifiedByUserId);

    if (verifiedByAdminAt && !resolvedUserId && !verifiedBy) {
      throw new AppException(
        "verifiedBy is required when verifiedByAdminAt is set",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolveDeliveryId(row: any): string | undefined {
    if (typeof row?.deliveryId === "string" && row.deliveryId.trim().length > 0) {
      return row.deliveryId.trim();
    }

    if (row?.delivery?.connect?.id) {
      return row.delivery.connect.id;
    }

    return undefined;
  }

  private resolveUserId(relation: any, scalar: any): string | undefined {
    if (typeof scalar === "string" && scalar.trim().length > 0) {
      return scalar.trim();
    }

    if (relation?.connect?.id) {
      return relation.connect.id;
    }

    return undefined;
  }

  private ensureOptionalNonNegativeInteger(value: unknown, message: string): void {
    if (value === undefined || value === null) {
      return;
    }

    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
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
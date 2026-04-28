// src/domain/driverPayout/driverPayoutPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDriverPayoutStatus,
  EnumDriverStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DriverPayoutPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DriverPayoutCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const deliveryId = this.resolveRelationId(row.delivery, row.deliveryId);
    if (!deliveryId) {
      throw new AppException(
        "delivery is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const driverId = this.resolveRelationId(row.driver, row.driverId);
    if (!driverId) {
      throw new AppException(
        "driver is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const delivery = await this.ensureDeliveryExists(client, deliveryId);
    const driver = await this.ensureDriverExists(client, driverId);

    this.validateDeliveryAllowsPayout(delivery.status);
    this.validateDriverAllowsPayout(driver.status);

    this.ensurePercent(
      row.driverSharePct,
      "driverSharePct must be between 0 and 100"
    );
    this.ensureNonNegativeNumber(
      row.grossAmount,
      "grossAmount must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      row.insuranceFee,
      "insuranceFee must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      row.platformFee,
      "platformFee must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      row.netAmount,
      "netAmount must be a non-negative number"
    );

    this.validateAmountConsistency(
      Number(row.grossAmount),
      Number(row.insuranceFee),
      Number(row.platformFee),
      Number(row.netAmount)
    );

    this.ensurePayoutStatus(row.status ?? EnumDriverPayoutStatus.PENDING);
    this.validatePayoutStatusFields(row);

    await this.ensureNoExistingPayoutForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DriverPayoutUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DriverPayout id is required for update");

    const existing = await client.driverPayout.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        driverId: true,
        grossAmount: true,
        insuranceFee: true,
        platformFee: true,
        netAmount: true,
        driverSharePct: true,
        providerTransferId: true,
        failureMessage: true,
        status: true,
        paidAt: true,
        failedAt: true,
        delivery: {
          select: {
            status: true,
          },
        },
        driver: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DriverPayout '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("driver" in (data as any) || "driverId" in (data as any)) {
      throw new AppException(
        "driver relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      grossAmount: this.resolveUpdatedValue(data.grossAmount, existing!.grossAmount),
      insuranceFee: this.resolveUpdatedValue(data.insuranceFee, existing!.insuranceFee),
      platformFee: this.resolveUpdatedValue(data.platformFee, existing!.platformFee),
      netAmount: this.resolveUpdatedValue(data.netAmount, existing!.netAmount),
      driverSharePct: this.resolveUpdatedValue(
        data.driverSharePct,
        existing!.driverSharePct
      ),
      providerTransferId: this.resolveUpdatedValue(
        data.providerTransferId,
        existing!.providerTransferId
      ),
      failureMessage: this.resolveUpdatedValue(
        data.failureMessage,
        existing!.failureMessage
      ),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      paidAt: this.resolveUpdatedValue(data.paidAt, existing!.paidAt),
      failedAt: this.resolveUpdatedValue(data.failedAt, existing!.failedAt),
    };

    this.validateDeliveryAllowsPayout(existing!.delivery.status);
    this.validateDriverAllowsPayout(existing!.driver.status);

    this.ensurePercent(
      merged.driverSharePct,
      "driverSharePct must be between 0 and 100"
    );
    this.ensureNonNegativeNumber(
      merged.grossAmount,
      "grossAmount must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      merged.insuranceFee,
      "insuranceFee must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      merged.platformFee,
      "platformFee must be a non-negative number"
    );
    this.ensureNonNegativeNumber(
      merged.netAmount,
      "netAmount must be a non-negative number"
    );

    this.validateAmountConsistency(
      Number(merged.grossAmount),
      Number(merged.insuranceFee),
      Number(merged.platformFee),
      Number(merged.netAmount)
    );

    this.ensurePayoutStatus(merged.status);
    this.validatePayoutStatusFields(merged);
    this.validateStatusTransition(existing!.status, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DriverPayout id is required for delete");

    const existing = await client.driverPayout.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
      },
    });

    this.ensureFound(existing, `DriverPayout '${id}' not found`);

    if (
      existing!.status !== EnumDriverPayoutStatus.PENDING &&
      existing!.status !== EnumDriverPayoutStatus.FAILED
    ) {
      throw new AppException(
        "Only PENDING or FAILED payouts can be deleted",
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

  private async ensureNoExistingPayoutForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.driverPayout.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DriverPayout already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsPayout(status: EnumDeliveryRequestStatus): void {
    if (
      status !== EnumDeliveryRequestStatus.COMPLETED &&
      status !== EnumDeliveryRequestStatus.DISPUTED
    ) {
      throw new AppException(
        "DriverPayout is only allowed for COMPLETED or DISPUTED deliveries",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateDriverAllowsPayout(status: EnumDriverStatus): void {
    if (status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "Driver must be APPROVED before payout",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateAmountConsistency(
    grossAmount: number,
    insuranceFee: number,
    platformFee: number,
    netAmount: number
  ): void {
    const expected = grossAmount - insuranceFee - platformFee;
    const roundedExpected = Number(expected.toFixed(2));
    const roundedActual = Number(netAmount.toFixed(2));

    if (roundedExpected !== roundedActual) {
      throw new AppException(
        "netAmount must equal grossAmount minus insuranceFee minus platformFee",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validatePayoutStatusFields(row: any): void {
    if (row.status === EnumDriverPayoutStatus.PAID && !row.paidAt) {
      throw new AppException(
        "paidAt is required when status is PAID",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.status === EnumDriverPayoutStatus.FAILED && !row.failedAt) {
      throw new AppException(
        "failedAt is required when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.failedAt && row.status !== EnumDriverPayoutStatus.FAILED) {
      throw new AppException(
        "failedAt is only allowed when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.paidAt && row.status !== EnumDriverPayoutStatus.PAID) {
      throw new AppException(
        "paidAt is only allowed when status is PAID",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumDriverPayoutStatus,
    toStatus: EnumDriverPayoutStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumDriverPayoutStatus, EnumDriverPayoutStatus[]> = {
      PENDING: [EnumDriverPayoutStatus.ELIGIBLE, EnumDriverPayoutStatus.FAILED, EnumDriverPayoutStatus.CANCELLED],
      ELIGIBLE: [EnumDriverPayoutStatus.PAID, EnumDriverPayoutStatus.FAILED, EnumDriverPayoutStatus.CANCELLED],
      PAID: [EnumDriverPayoutStatus.PAID],
      FAILED: [EnumDriverPayoutStatus.FAILED],
      CANCELLED: [EnumDriverPayoutStatus.CANCELLED],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "DriverPayout status transition is invalid",
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

  private ensurePayoutStatus(value: unknown): void {
    if (
      value !== EnumDriverPayoutStatus.PENDING &&
      value !== EnumDriverPayoutStatus.ELIGIBLE &&
      value !== EnumDriverPayoutStatus.PAID &&
      value !== EnumDriverPayoutStatus.FAILED &&
      value !== EnumDriverPayoutStatus.CANCELLED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensurePercent(value: unknown, message: string): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < 0 || num > 100) {
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
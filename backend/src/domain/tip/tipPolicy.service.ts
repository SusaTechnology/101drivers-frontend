// src/domain/tip/tipPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumTipProvider,
  EnumTipStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class TipPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.TipCreateArgs["data"]
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

    this.ensureNonNegativeNumber(row.amount, "amount must be a non-negative number");
    this.ensureProvider(row.provider ?? EnumTipProvider.STRIPE);
    this.ensureStatus(row.status ?? EnumTipStatus.AUTHORIZED);

    this.validateDeliveryAllowsTip(delivery.status);
    this.validateTipStatusFields(row);

    await this.ensureNoExistingTipForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.TipUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "Tip id is required for update");

    const existing = await client.tip.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        amount: true,
        provider: true,
        providerRef: true,
        status: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `Tip '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      amount: this.resolveUpdatedValue(data.amount, existing!.amount),
      provider: this.resolveUpdatedValue(data.provider, existing!.provider),
      providerRef: this.resolveUpdatedValue(data.providerRef, existing!.providerRef),
      status: this.resolveUpdatedValue(data.status, existing!.status),
    };

    this.ensureNonNegativeNumber(
      merged.amount,
      "amount must be a non-negative number"
    );
    this.ensureProvider(merged.provider);
    this.ensureStatus(merged.status);

    this.validateDeliveryAllowsTip(existing!.delivery.status);
    this.validateTipStatusFields(merged);
    this.validateStatusTransition(existing!.status, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "Tip id is required for delete");

    const existing = await client.tip.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
      },
    });

    this.ensureFound(existing, `Tip '${id}' not found`);

    if (
      existing!.status !== EnumTipStatus.AUTHORIZED &&
      existing!.status !== EnumTipStatus.FAILED
    ) {
      throw new AppException(
        "Only AUTHORIZED or FAILED tips can be deleted",
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

  private async ensureNoExistingTipForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.tip.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "Tip already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsTip(status: EnumDeliveryRequestStatus): void {
    if (status !== EnumDeliveryRequestStatus.COMPLETED) {
      throw new AppException(
        "Tip is only allowed for COMPLETED deliveries",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateTipStatusFields(row: any): void {
    if (
      row.status === EnumTipStatus.CAPTURED &&
      (!row.providerRef || String(row.providerRef).trim().length === 0)
    ) {
      throw new AppException(
        "providerRef is required when status is CAPTURED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (
      row.status === EnumTipStatus.REFUNDED &&
      (!row.providerRef || String(row.providerRef).trim().length === 0)
    ) {
      throw new AppException(
        "providerRef is required when status is REFUNDED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumTipStatus,
    toStatus: EnumTipStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumTipStatus, EnumTipStatus[]> = {
      AUTHORIZED: [EnumTipStatus.CAPTURED, EnumTipStatus.FAILED],
      CAPTURED: [EnumTipStatus.REFUNDED],
      FAILED: [EnumTipStatus.FAILED],
      REFUNDED: [EnumTipStatus.REFUNDED],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "Tip status transition is invalid",
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

  private ensureProvider(value: unknown): void {
    if (
      value !== EnumTipProvider.STRIPE &&
      value !== EnumTipProvider.MANUAL &&
      value !== EnumTipProvider.OTHER
    ) {
      throw new AppException(
        "provider is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumTipStatus.AUTHORIZED &&
      value !== EnumTipStatus.CAPTURED &&
      value !== EnumTipStatus.FAILED &&
      value !== EnumTipStatus.REFUNDED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
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
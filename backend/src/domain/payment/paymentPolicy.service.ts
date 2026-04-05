// src/domain/payment/paymentPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumPaymentPaymentType,
  EnumPaymentProvider,
  EnumPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class PaymentPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.PaymentCreateArgs["data"]
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
    this.ensurePaymentType(row.paymentType);
    this.ensureProvider(row.provider ?? EnumPaymentProvider.STRIPE);
    this.ensureStatus(row.status);

    this.validatePaymentStatusFields(row);
    this.validateDeliveryAllowsPayment(delivery.status);
    await this.ensureNoExistingPaymentForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.PaymentUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "Payment id is required for update");

    const existing = await client.payment.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        amount: true,
        paymentType: true,
        provider: true,
        status: true,
        invoiceId: true,
        providerChargeId: true,
        providerPaymentIntentId: true,
        failureCode: true,
        failureMessage: true,
        authorizedAt: true,
        capturedAt: true,
        paidAt: true,
        failedAt: true,
        voidedAt: true,
        refundedAt: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `Payment '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      amount: this.resolveUpdatedValue(data.amount, existing!.amount),
      paymentType: this.resolveUpdatedValue(data.paymentType, existing!.paymentType),
      provider: this.resolveUpdatedValue(data.provider, existing!.provider),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      invoiceId: this.resolveUpdatedValue(data.invoiceId, existing!.invoiceId),
      providerChargeId: this.resolveUpdatedValue(
        data.providerChargeId,
        existing!.providerChargeId
      ),
      providerPaymentIntentId: this.resolveUpdatedValue(
        data.providerPaymentIntentId,
        existing!.providerPaymentIntentId
      ),
      failureCode: this.resolveUpdatedValue(data.failureCode, existing!.failureCode),
      failureMessage: this.resolveUpdatedValue(
        data.failureMessage,
        existing!.failureMessage
      ),
      authorizedAt: this.resolveUpdatedValue(data.authorizedAt, existing!.authorizedAt),
      capturedAt: this.resolveUpdatedValue(data.capturedAt, existing!.capturedAt),
      paidAt: this.resolveUpdatedValue(data.paidAt, existing!.paidAt),
      failedAt: this.resolveUpdatedValue(data.failedAt, existing!.failedAt),
      voidedAt: this.resolveUpdatedValue(data.voidedAt, existing!.voidedAt),
      refundedAt: this.resolveUpdatedValue(data.refundedAt, existing!.refundedAt),
    };

    this.ensureNonNegativeNumber(merged.amount, "amount must be a non-negative number");
    this.ensurePaymentType(merged.paymentType);
    this.ensureProvider(merged.provider);
    this.ensureStatus(merged.status);

    this.validatePaymentStatusFields(merged);
    this.validateDeliveryAllowsPayment(existing!.delivery.status);
    this.validateStatusTransition(existing!.status, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "Payment id is required for delete");

    const existing = await client.payment.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    this.ensureFound(existing, `Payment '${id}' not found`);

    if (
      existing!.status !== EnumPaymentStatus.AUTHORIZED &&
      existing!.status !== EnumPaymentStatus.FAILED
    ) {
      throw new AppException(
        "Only AUTHORIZED or FAILED payments can be deleted",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }

    if (existing!._count.events > 0) {
      throw new AppException(
        "Payment cannot be deleted because related events exist",
        ErrorCodes.STILL_IN_USE,
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

  private async ensureNoExistingPaymentForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.payment.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "Payment already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsPayment(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "Payment is not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validatePaymentStatusFields(row: any): void {
    if (row.status === EnumPaymentStatus.AUTHORIZED) {
      if (!row.authorizedAt) {
        throw new AppException(
          "authorizedAt is required when status is AUTHORIZED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (row.status === EnumPaymentStatus.CAPTURED && !row.capturedAt) {
      throw new AppException(
        "capturedAt is required when status is CAPTURED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.status === EnumPaymentStatus.PAID && !row.paidAt) {
      throw new AppException(
        "paidAt is required when status is PAID",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.status === EnumPaymentStatus.FAILED && !row.failedAt) {
      throw new AppException(
        "failedAt is required when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.status === EnumPaymentStatus.VOIDED && !row.voidedAt) {
      throw new AppException(
        "voidedAt is required when status is VOIDED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.status === EnumPaymentStatus.REFUNDED && !row.refundedAt) {
      throw new AppException(
        "refundedAt is required when status is REFUNDED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.failedAt && row.status !== EnumPaymentStatus.FAILED) {
      throw new AppException(
        "failedAt is only allowed when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.voidedAt && row.status !== EnumPaymentStatus.VOIDED) {
      throw new AppException(
        "voidedAt is only allowed when status is VOIDED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.refundedAt && row.status !== EnumPaymentStatus.REFUNDED) {
      throw new AppException(
        "refundedAt is only allowed when status is REFUNDED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumPaymentStatus,
    toStatus: EnumPaymentStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumPaymentStatus, EnumPaymentStatus[]> = {
      AUTHORIZED: ["CAPTURED", "FAILED", "VOIDED", "AUTHORIZED"],
      CAPTURED: ["PAID", "REFUNDED", "CAPTURED"],
      FAILED: ["FAILED"],
      INVOICED: ["PAID", "FAILED", "INVOICED"],
      PAID: ["REFUNDED", "PAID"],
      VOIDED: ["VOIDED"],
      REFUNDED: ["REFUNDED"],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "Payment status transition is invalid",
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

  private ensurePaymentType(value: unknown): void {
    if (
      value !== EnumPaymentPaymentType.PREPAID &&
      value !== EnumPaymentPaymentType.POSTPAID
    ) {
      throw new AppException(
        "paymentType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureProvider(value: unknown): void {
    if (
      value !== EnumPaymentProvider.STRIPE &&
      value !== EnumPaymentProvider.MANUAL &&
      value !== EnumPaymentProvider.OTHER
    ) {
      throw new AppException(
        "provider is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumPaymentStatus.AUTHORIZED &&
      value !== EnumPaymentStatus.CAPTURED &&
      value !== EnumPaymentStatus.FAILED &&
      value !== EnumPaymentStatus.INVOICED &&
      value !== EnumPaymentStatus.PAID &&
      value !== EnumPaymentStatus.VOIDED &&
      value !== EnumPaymentStatus.REFUNDED
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
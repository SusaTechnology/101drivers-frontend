// src/domain/paymentEvent/paymentEventPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumPaymentEventStatus,
  EnumPaymentEventType,
  EnumPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class PaymentEventPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.PaymentEventCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const paymentId = this.resolvePaymentId(row);
    if (!paymentId) {
      throw new AppException(
        "payment is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const payment = await this.ensurePaymentExists(client, paymentId);

    this.ensureEventType(row.type);
    this.ensureOptionalEventStatus(row.status);

    if (row.amount !== undefined && row.amount !== null) {
      this.ensureNonNegativeNumber(
        row.amount,
        "amount must be a non-negative number"
      );
    }

    this.validateEventTypeAgainstPaymentStatus(row.type, payment.status);
    this.validateEventStatusConsistency(row.type, row.status);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.PaymentEventUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "PaymentEvent id is required for update");

    const existing = await client.paymentEvent.findUnique({
      where: { id: id! },
      select: {
        id: true,
        paymentId: true,
        type: true,
        status: true,
        amount: true,
        providerRef: true,
        message: true,
        payment: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `PaymentEvent '${id}' not found`);

    if ("payment" in (data as any) || "paymentId" in (data as any)) {
      throw new AppException(
        "payment relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      type: this.resolveUpdatedValue(data.type, existing!.type),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      amount: this.resolveUpdatedValue(data.amount, existing!.amount),
    };

    this.ensureEventType(merged.type);
    this.ensureOptionalEventStatus(merged.status);

    if (merged.amount !== undefined && merged.amount !== null) {
      this.ensureNonNegativeNumber(
        merged.amount,
        "amount must be a non-negative number"
      );
    }

    this.validateEventTypeAgainstPaymentStatus(merged.type, existing!.payment.status);
    this.validateEventStatusConsistency(merged.type, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "PaymentEvent id is required for delete");

    const existing = await client.paymentEvent.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `PaymentEvent '${id}' not found`);
  }

  private async ensurePaymentExists(client: PrismaClient, paymentId: string) {
    const row = await client.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!row) {
      throw new AppException(
        `Payment '${paymentId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private validateEventTypeAgainstPaymentStatus(
    type: EnumPaymentEventType,
    paymentStatus: EnumPaymentStatus
  ): void {
    const allowedByStatus: Record<EnumPaymentStatus, EnumPaymentEventType[]> = {
      AUTHORIZED: [EnumPaymentEventType.AUTHORIZE, EnumPaymentEventType.FAIL, EnumPaymentEventType.VOID],
      CAPTURED: [EnumPaymentEventType.CAPTURE, EnumPaymentEventType.REFUND],
      FAILED: [EnumPaymentEventType.FAIL],
      INVOICED: [EnumPaymentEventType.INVOICE, EnumPaymentEventType.MARK_PAID, EnumPaymentEventType.FAIL],
      PAID: [EnumPaymentEventType.MARK_PAID, EnumPaymentEventType.REFUND],
      VOIDED: [EnumPaymentEventType.VOID],
      REFUNDED: [EnumPaymentEventType.REFUND],
    };

    if (!allowedByStatus[paymentStatus].includes(type)) {
      throw new AppException(
        "PaymentEvent type is not valid for the current payment status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateEventStatusConsistency(
    type: EnumPaymentEventType,
    status: EnumPaymentEventStatus | null | undefined
  ): void {
    if (status === undefined || status === null) {
      return;
    }

    const expected: Partial<Record<EnumPaymentEventType, EnumPaymentEventStatus>> = {
      AUTHORIZE: EnumPaymentEventStatus.AUTHORIZED,
      CAPTURE: EnumPaymentEventStatus.CAPTURED,
      INVOICE: EnumPaymentEventStatus.INVOICED,
      MARK_PAID: EnumPaymentEventStatus.PAID,
      FAIL: EnumPaymentEventStatus.FAILED,
      VOID: EnumPaymentEventStatus.VOIDED,
      REFUND: EnumPaymentEventStatus.REFUNDED,
    };

    if (expected[type] && expected[type] !== status) {
      throw new AppException(
        "PaymentEvent status does not match its type",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private resolvePaymentId(row: any): string | undefined {
    if (typeof row?.paymentId === "string" && row.paymentId.trim().length > 0) {
      return row.paymentId.trim();
    }

    if (row?.payment?.connect?.id) {
      return row.payment.connect.id;
    }

    return undefined;
  }

  private ensureEventType(value: unknown): void {
    if (
      value !== EnumPaymentEventType.AUTHORIZE &&
      value !== EnumPaymentEventType.CAPTURE &&
      value !== EnumPaymentEventType.INVOICE &&
      value !== EnumPaymentEventType.MARK_PAID &&
      value !== EnumPaymentEventType.FAIL &&
      value !== EnumPaymentEventType.VOID &&
      value !== EnumPaymentEventType.REFUND
    ) {
      throw new AppException(
        "type is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalEventStatus(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumPaymentEventStatus.AUTHORIZED &&
      value !== EnumPaymentEventStatus.CAPTURED &&
      value !== EnumPaymentEventStatus.INVOICED &&
      value !== EnumPaymentEventStatus.PAID &&
      value !== EnumPaymentEventStatus.FAILED &&
      value !== EnumPaymentEventStatus.VOIDED &&
      value !== EnumPaymentEventStatus.REFUNDED
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
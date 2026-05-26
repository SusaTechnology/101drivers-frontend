// src/domain/disputeCase/disputeCasePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDisputeCaseStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DisputeCasePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DisputeCaseCreateArgs["data"]
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

    this.ensureRequiredString(row.reason, "reason is required");
    this.ensureStatus(row.status ?? EnumDisputeCaseStatus.OPEN);

    this.validateDeliveryAllowsDispute(delivery.status);
    this.validateDisputeDates(
      row.openedAt,
      row.resolvedAt,
      row.closedAt,
      row.status ?? EnumDisputeCaseStatus.OPEN
    );

    await this.ensureNoExistingDisputeForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DisputeCaseUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DisputeCase id is required for update");

    const existing = await client.disputeCase.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        reason: true,
        legalHold: true,
        status: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        delivery: {
          select: {
            status: true,
          },
        },
        _count: {
          select: {
            notes: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DisputeCase '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      reason: this.resolveUpdatedValue(data.reason, existing!.reason),
      legalHold: this.resolveUpdatedValue(data.legalHold, existing!.legalHold),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      openedAt: this.resolveUpdatedValue(data.openedAt, existing!.openedAt),
      resolvedAt: this.resolveUpdatedValue(data.resolvedAt, existing!.resolvedAt),
      closedAt: this.resolveUpdatedValue(data.closedAt, existing!.closedAt),
    };

    this.ensureRequiredString(merged.reason, "reason is required");
    this.ensureStatus(merged.status);

    this.validateDeliveryAllowsDispute(existing!.delivery.status);
    this.validateDisputeDates(
      merged.openedAt,
      merged.resolvedAt,
      merged.closedAt,
      merged.status
    );
    this.validateStatusTransition(existing!.status, merged.status);

    if (
      merged.closedAt &&
      existing!._count.notes === 0 &&
      !existing!.legalHold
    ) {
      throw new AppException(
        "DisputeCase should have at least one note or legalHold before closing",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DisputeCase id is required for delete");

    const existing = await client.disputeCase.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
        legalHold: true,
        _count: {
          select: {
            notes: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DisputeCase '${id}' not found`);

    if (existing!.legalHold) {
      throw new AppException(
        "DisputeCase cannot be deleted while legalHold is enabled",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }

    if (existing!._count.notes > 0) {
      throw new AppException(
        "DisputeCase cannot be deleted because related notes exist",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }

    if (
      existing!.status !== EnumDisputeCaseStatus.OPEN &&
      existing!.status !== EnumDisputeCaseStatus.UNDER_REVIEW
    ) {
      throw new AppException(
        "Only OPEN or UNDER_REVIEW dispute cases can be deleted",
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

  private async ensureNoExistingDisputeForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.disputeCase.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DisputeCase already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsDispute(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.QUOTED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "DisputeCase is not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateDisputeDates(
    openedAt: Date | string | null | undefined,
    resolvedAt: Date | string | null | undefined,
    closedAt: Date | string | null | undefined,
    status: EnumDisputeCaseStatus
  ): void {
    const opened = new Date(openedAt as any);
    if (Number.isNaN(opened.getTime())) {
      throw new AppException(
        "openedAt is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (resolvedAt) {
      const resolved = new Date(resolvedAt as any);
      if (Number.isNaN(resolved.getTime())) {
        throw new AppException(
          "resolvedAt is invalid",
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (resolved < opened) {
        throw new AppException(
          "resolvedAt cannot be earlier than openedAt",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    if (closedAt) {
      const closed = new Date(closedAt as any);
      if (Number.isNaN(closed.getTime())) {
        throw new AppException(
          "closedAt is invalid",
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (closed < opened) {
        throw new AppException(
          "closedAt cannot be earlier than openedAt",
          ErrorCodes.VALIDATION_ERROR
        );
      }
      if (resolvedAt) {
        const resolved = new Date(resolvedAt as any);
        if (closed < resolved) {
          throw new AppException(
            "closedAt cannot be earlier than resolvedAt",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }

    if (status === EnumDisputeCaseStatus.RESOLVED && !resolvedAt) {
      throw new AppException(
        "resolvedAt is required when status is RESOLVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (status === EnumDisputeCaseStatus.CLOSED && !closedAt) {
      throw new AppException(
        "closedAt is required when status is CLOSED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumDisputeCaseStatus,
    toStatus: EnumDisputeCaseStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumDisputeCaseStatus, EnumDisputeCaseStatus[]> = {
      OPEN: [EnumDisputeCaseStatus.UNDER_REVIEW, EnumDisputeCaseStatus.RESOLVED, EnumDisputeCaseStatus.CLOSED],
      UNDER_REVIEW: [EnumDisputeCaseStatus.RESOLVED, EnumDisputeCaseStatus.CLOSED],
      RESOLVED: [EnumDisputeCaseStatus.CLOSED],
      CLOSED: [],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "DisputeCase status transition is invalid",
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

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumDisputeCaseStatus.OPEN &&
      value !== EnumDisputeCaseStatus.UNDER_REVIEW &&
      value !== EnumDisputeCaseStatus.RESOLVED &&
      value !== EnumDisputeCaseStatus.CLOSED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
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
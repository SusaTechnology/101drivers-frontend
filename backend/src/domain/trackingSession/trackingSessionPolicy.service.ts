// src/domain/trackingSession/trackingSessionPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumTrackingSessionStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class TrackingSessionPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.TrackingSessionCreateArgs["data"]
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

    this.ensureTrackingStatus(row.status ?? EnumTrackingSessionStatus.NOT_STARTED);
    this.validateSessionTiming(row.status, row.startedAt, row.stoppedAt);
    this.ensureOptionalNonNegativeNumber(
      row.drivenMiles,
      "drivenMiles must be a non-negative number"
    );
    this.validateDeliveryTrackable(delivery.status);

    await this.ensureNoExistingSessionForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.TrackingSessionUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "TrackingSession id is required for update");

    const existing = await client.trackingSession.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        status: true,
        startedAt: true,
        stoppedAt: true,
        drivenMiles: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `TrackingSession '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      status: this.resolveUpdatedValue(data.status, existing!.status),
      startedAt: this.resolveUpdatedValue(data.startedAt, existing!.startedAt),
      stoppedAt: this.resolveUpdatedValue(data.stoppedAt, existing!.stoppedAt),
      drivenMiles: this.resolveUpdatedValue(data.drivenMiles, existing!.drivenMiles),
    };

    this.ensureTrackingStatus(merged.status);
    this.validateSessionTiming(merged.status, merged.startedAt, merged.stoppedAt);
    this.ensureOptionalNonNegativeNumber(
      merged.drivenMiles,
      "drivenMiles must be a non-negative number"
    );
    this.validateDeliveryTrackable(existing!.delivery.status);
    this.validateStatusTransition(existing!.status, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "TrackingSession id is required for delete");

    const existing = await client.trackingSession.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            points: true,
          },
        },
      },
    });

    this.ensureFound(existing, `TrackingSession '${id}' not found`);

    if (
      existing!.status !== EnumTrackingSessionStatus.NOT_STARTED ||
      existing!._count.points > 0
    ) {
      throw new AppException(
        "Only NOT_STARTED tracking sessions without points can be deleted",
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

  private async ensureNoExistingSessionForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.trackingSession.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "TrackingSession already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryTrackable(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.QUOTED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "DeliveryRequest is not trackable in its current status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateSessionTiming(
    status: EnumTrackingSessionStatus,
    startedAt: Date | string | null | undefined,
    stoppedAt: Date | string | null | undefined
  ): void {
    if (status === EnumTrackingSessionStatus.NOT_STARTED) {
      if (startedAt || stoppedAt) {
        throw new AppException(
          "startedAt and stoppedAt are not allowed when status is NOT_STARTED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
      return;
    }

    if (status === EnumTrackingSessionStatus.STARTED) {
      if (!startedAt) {
        throw new AppException(
          "startedAt is required when status is STARTED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }

      if (stoppedAt) {
        throw new AppException(
          "stoppedAt is not allowed when status is STARTED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }

      return;
    }

    if (status === EnumTrackingSessionStatus.STOPPED) {
      if (!startedAt || !stoppedAt) {
        throw new AppException(
          "startedAt and stoppedAt are required when status is STOPPED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }

      const start = new Date(startedAt as any);
      const stop = new Date(stoppedAt as any);

      if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime())) {
        throw new AppException(
          "Tracking session dates are invalid",
          ErrorCodes.VALIDATION_ERROR
        );
      }

      if (stop < start) {
        throw new AppException(
          "stoppedAt cannot be earlier than startedAt",
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }

  private validateStatusTransition(
    fromStatus: EnumTrackingSessionStatus,
    toStatus: EnumTrackingSessionStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumTrackingSessionStatus, EnumTrackingSessionStatus[]> = {
      NOT_STARTED: [EnumTrackingSessionStatus.STARTED],
      STARTED: [EnumTrackingSessionStatus.STOPPED],
      STOPPED: [],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "TrackingSession status transition is invalid",
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

  private ensureTrackingStatus(value: unknown): void {
    if (
      value !== EnumTrackingSessionStatus.NOT_STARTED &&
      value !== EnumTrackingSessionStatus.STARTED &&
      value !== EnumTrackingSessionStatus.STOPPED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalNonNegativeNumber(value: unknown, message: string): void {
    if (value === undefined || value === null) {
      return;
    }

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
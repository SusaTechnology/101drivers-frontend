// src/domain/trackingPoint/trackingPointPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumTrackingSessionStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class TrackingPointPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.TrackingPointCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const sessionId = this.resolveSessionId(row);
    if (!sessionId) {
      throw new AppException(
        "session is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const session = await this.ensureSessionExists(client, sessionId);

    this.ensureLatitude(row.lat);
    this.ensureLongitude(row.lng);
    this.ensureOptionalRecordedAt(row.recordedAt);
    this.validateSessionAllowsPoints(session.status);

    if (row.recordedAt && session.startedAt) {
      const recordedAt = new Date(row.recordedAt);
      const startedAt = new Date(session.startedAt);

      if (!Number.isNaN(recordedAt.getTime()) && !Number.isNaN(startedAt.getTime())) {
        if (recordedAt < startedAt) {
          throw new AppException(
            "recordedAt cannot be earlier than session startedAt",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }

    if (row.recordedAt && session.stoppedAt) {
      const recordedAt = new Date(row.recordedAt);
      const stoppedAt = new Date(session.stoppedAt);

      if (!Number.isNaN(recordedAt.getTime()) && !Number.isNaN(stoppedAt.getTime())) {
        if (recordedAt > stoppedAt) {
          throw new AppException(
            "recordedAt cannot be later than session stoppedAt",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.TrackingPointUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "TrackingPoint id is required for update");

    const existing = await client.trackingPoint.findUnique({
      where: { id: id! },
      select: {
        id: true,
        sessionId: true,
        lat: true,
        lng: true,
        recordedAt: true,
        session: {
          select: {
            status: true,
            startedAt: true,
            stoppedAt: true,
          },
        },
      },
    });

    this.ensureFound(existing, `TrackingPoint '${id}' not found`);

    if ("session" in (data as any) || "sessionId" in (data as any)) {
      throw new AppException(
        "session relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      lat: this.resolveUpdatedValue(data.lat, existing!.lat),
      lng: this.resolveUpdatedValue(data.lng, existing!.lng),
      recordedAt: this.resolveUpdatedValue(data.recordedAt, existing!.recordedAt),
    };

    this.ensureLatitude(merged.lat);
    this.ensureLongitude(merged.lng);
    this.ensureOptionalRecordedAt(merged.recordedAt);
    this.validateSessionAllowsPoints(existing!.session.status);

    if (merged.recordedAt && existing!.session.startedAt) {
      const recordedAt = new Date(merged.recordedAt);
      const startedAt = new Date(existing!.session.startedAt);

      if (!Number.isNaN(recordedAt.getTime()) && !Number.isNaN(startedAt.getTime())) {
        if (recordedAt < startedAt) {
          throw new AppException(
            "recordedAt cannot be earlier than session startedAt",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }

    if (merged.recordedAt && existing!.session.stoppedAt) {
      const recordedAt = new Date(merged.recordedAt);
      const stoppedAt = new Date(existing!.session.stoppedAt);

      if (!Number.isNaN(recordedAt.getTime()) && !Number.isNaN(stoppedAt.getTime())) {
        if (recordedAt > stoppedAt) {
          throw new AppException(
            "recordedAt cannot be later than session stoppedAt",
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "TrackingPoint id is required for delete");

    const existing = await client.trackingPoint.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `TrackingPoint '${id}' not found`);
  }

  private async ensureSessionExists(client: PrismaClient, sessionId: string) {
    const row = await client.trackingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        stoppedAt: true,
      },
    });

    if (!row) {
      throw new AppException(
        `TrackingSession '${sessionId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private validateSessionAllowsPoints(status: EnumTrackingSessionStatus): void {
    if (
      status !== EnumTrackingSessionStatus.STARTED &&
      status !== EnumTrackingSessionStatus.STOPPED
    ) {
      throw new AppException(
        "Tracking points can only be added when session is STARTED or STOPPED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private ensureLatitude(value: unknown): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < -90 || num > 90) {
      throw new AppException(
        "lat must be a valid latitude",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureLongitude(value: unknown): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < -180 || num > 180) {
      throw new AppException(
        "lng must be a valid longitude",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalRecordedAt(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) {
      throw new AppException(
        "recordedAt is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private resolveSessionId(row: any): string | undefined {
    if (typeof row?.sessionId === "string" && row.sessionId.trim().length > 0) {
      return row.sessionId.trim();
    }

    if (row?.session?.connect?.id) {
      return row.session.connect.id;
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
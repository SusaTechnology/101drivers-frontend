import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class OperatingHourPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.OperatingHourCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    row.dayOfWeek = this.normalizeDayOfWeek(row.dayOfWeek);
    this.ensureTimeString(row.startTime, "startTime");
    this.ensureTimeString(row.endTime, "endTime");
    this.ensureEndAfterStart(row.startTime, row.endTime);

    await this.ensureNoOverlap(
      client,
      row.dayOfWeek,
      row.startTime,
      row.endTime,
      row.active
    );
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.OperatingHourUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "OperatingHour id is required for update");

    const existing = await client.operatingHour.findUnique({
      where: { id: id! },
      select: {
        id: true,
        active: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    });

    this.ensureFound(existing, `OperatingHour '${id}' not found`);

    const merged = {
      active: this.resolveUpdatedValue(data.active, existing!.active),
      dayOfWeek: this.normalizeDayOfWeek(
        this.resolveUpdatedValue(data.dayOfWeek, existing!.dayOfWeek)
      ),
      startTime: this.resolveUpdatedValue(data.startTime, existing!.startTime),
      endTime: this.resolveUpdatedValue(data.endTime, existing!.endTime),
    };

    this.ensureTimeString(merged.startTime, "startTime");
    this.ensureTimeString(merged.endTime, "endTime");
    this.ensureEndAfterStart(merged.startTime, merged.endTime);

    await this.ensureNoOverlap(
      client,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      merged.active,
      id!
    );
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "OperatingHour id is required for delete");

    const existing = await client.operatingHour.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `OperatingHour '${id}' not found`);
  }

  private async ensureNoOverlap(
    client: PrismaClient,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    active: boolean,
    excludeId?: string
  ): Promise<void> {
    if (!active) {
      return;
    }

    const rows = await client.operatingHour.findMany({
      where: {
        active: true,
        dayOfWeek,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
      },
    });

    const nextStart = this.toMinutes(startTime);
    const nextEnd = this.toMinutes(endTime);

    for (const row of rows) {
      const rowStart = this.toMinutes(row.startTime);
      const rowEnd = this.toMinutes(row.endTime);

      const overlaps = nextStart < rowEnd && rowStart < nextEnd;
      if (overlaps) {
        throw new AppException(
          "OperatingHour ranges must not overlap for the same dayOfWeek",
          ErrorCodes.CONFLICT,
          HttpStatus.CONFLICT
        );
      }
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

  private normalizeDayOfWeek(value: unknown): number {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isInteger(num)) {
      throw new AppException(
        "dayOfWeek must be an integer",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (num >= 0 && num <= 6) {
      return num;
    }

    if (num >= 1 && num <= 7) {
      return num === 7 ? 0 : num;
    }

    throw new AppException(
      "dayOfWeek must be between 0 and 6, or between 1 and 7",
      ErrorCodes.VALIDATION_ERROR
    );
  }

  private ensureTimeString(value: unknown, field: string): void {
    if (typeof value !== "string") {
      throw new AppException(
        `${field} is invalid`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!hhmm.test(value.trim())) {
      throw new AppException(
        `${field} must be in HH:mm format`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureEndAfterStart(startTime: string, endTime: string): void {
    if (this.toMinutes(endTime) <= this.toMinutes(startTime)) {
      throw new AppException(
        "endTime must be greater than startTime",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private toMinutes(value: string): number {
    const [hh, mm] = value.split(":").map(Number);
    return hh * 60 + mm;
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
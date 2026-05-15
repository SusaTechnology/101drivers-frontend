// src/domain/timeSlotTemplate/timeSlotTemplatePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class TimeSlotTemplatePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.TimeSlotTemplateCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureRequiredString(row.label, "label is required");
    this.ensureTimeString(row.startTime, "startTime");
    this.ensureTimeString(row.endTime, "endTime");
    this.ensureEndAfterStart(row.startTime, row.endTime);

    await this.ensureUniqueLabel(client, row.label.trim());
    await this.ensureNoOverlappingTimeRange(client, row.startTime, row.endTime);
    await this.warnIfAfterCutoff(client, row.startTime);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.TimeSlotTemplateUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "TimeSlotTemplate id is required for update");

    const existing = await client.timeSlotTemplate.findUnique({
      where: { id: id! },
      select: {
        id: true,
        active: true,
        label: true,
        startTime: true,
        endTime: true,
      },
    });

    this.ensureFound(existing, `TimeSlotTemplate '${id}' not found`);

    const merged = {
      active: this.resolveUpdatedValue(data.active, existing!.active),
      label: this.resolveUpdatedValue(data.label, existing!.label),
      startTime: this.resolveUpdatedValue(data.startTime, existing!.startTime),
      endTime: this.resolveUpdatedValue(data.endTime, existing!.endTime),
    };

    this.ensureRequiredString(merged.label, "label is required");
    this.ensureTimeString(merged.startTime, "startTime");
    this.ensureTimeString(merged.endTime, "endTime");
    this.ensureEndAfterStart(merged.startTime, merged.endTime);

    if (merged.label !== existing!.label) {
      await this.ensureUniqueLabel(client, String(merged.label).trim(), id!);
    }

    if (
      merged.startTime !== existing!.startTime ||
      merged.endTime !== existing!.endTime
    ) {
      await this.ensureNoOverlappingTimeRange(
        client,
        String(merged.startTime),
        String(merged.endTime),
        id!
      );
    }

    await this.warnIfAfterCutoff(client, String(merged.startTime));
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "TimeSlotTemplate id is required for delete");

    const existing = await client.timeSlotTemplate.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `TimeSlotTemplate '${id}' not found`);
  }

  private async ensureUniqueLabel(
    client: PrismaClient,
    label: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.timeSlotTemplate.findFirst({
      where: {
        label,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "TimeSlotTemplate label already exists",
        ErrorCodes.DUPLICATE_TITLE,
        HttpStatus.CONFLICT
      );
    }
  }

  /**
   * Ensure no overlapping time ranges exist among active slot templates.
   * Uses interval overlap: [start1, end1) overlaps [start2, end2) iff start1 < end2 AND start2 < end1.
   */
  private async ensureNoOverlappingTimeRange(
    client: PrismaClient,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<void> {
    const rows = await client.timeSlotTemplate.findMany({
      where: {
        active: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        id: true,
        label: true,
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
          `Time slot "${row.label}" (${row.startTime}-${row.endTime}) overlaps with the new range (${startTime}-${endTime}). Overlapping time slots are not allowed.`,
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

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
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

  /**
   * If any active SAME_DAY policy has a cutoff time, warn when a slot
   * starts at or after that cutoff — it won't be available for same-day.
   */
  private async warnIfAfterCutoff(
    client: PrismaClient,
    startTime: string
  ): Promise<void> {
    const activePolicies = await client.schedulingPolicy.findMany({
      where: {
        active: true,
        defaultMode: "SAME_DAY",
        sameDayCutoffTime: { not: null },
      },
      select: { sameDayCutoffTime: true },
    });

    if (activePolicies.length === 0) return;

    const slotMinutes = this.toMinutes(startTime);

    for (const policy of activePolicies) {
      const cutoffMinutes = this.toMinutes(policy.sameDayCutoffTime!);
      if (slotMinutes >= cutoffMinutes) {
        const cutoff12 = this.to12Hour(policy.sameDayCutoffTime!);
        const slot12 = this.to12Hour(startTime);
        throw new AppException(
          `This slot (${slot12}) starts at or after the daily cutoff time (${cutoff12}). ` +
            `It will not be available to customers for same-day deliveries. ` +
            `Please adjust the cutoff time in the Scheduling Policy first, or choose an earlier slot.`,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }
  }

  private to12Hour(hhmm: string): string {
    const [hh, mm] = hhmm.split(":").map(Number);
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
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
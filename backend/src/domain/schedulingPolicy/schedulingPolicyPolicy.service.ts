// src/domain/schedulingPolicy/schedulingPolicyPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyDefaultMode,
  EnumSchedulingPolicyServiceType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class SchedulingPolicyPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.SchedulingPolicyCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureCustomerType(row.customerType);
    this.ensureDefaultMode(row.defaultMode);
    this.ensureOptionalServiceType(row.serviceType);

    this.ensureNonNegativeInteger(
      row.bufferMinutes,
      "bufferMinutes must be a non-negative integer"
    );

    if (row.maxSameDayMiles !== undefined && row.maxSameDayMiles !== null) {
      this.ensureNonNegativeNumber(
        row.maxSameDayMiles,
        "maxSameDayMiles must be a non-negative number"
      );
    }

    this.validateSameDayFields(row.defaultMode, row.sameDayCutoffTime, row.maxSameDayMiles);
    this.validateCutoffTime(row.sameDayCutoffTime);

    await this.ensureUniqueActiveCombination(
      client,
      row.customerType,
      row.serviceType,
      row.active
    );
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.SchedulingPolicyUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "SchedulingPolicy id is required for update");

    const existing = await client.schedulingPolicy.findUnique({
      where: { id: id! },
      select: {
        id: true,
        active: true,
        afterHoursEnabled: true,
        bufferMinutes: true,
        customerType: true,
        defaultMode: true,
        maxSameDayMiles: true,
        requiresOpsConfirmation: true,
        sameDayCutoffTime: true,
        serviceType: true,
      },
    });

    this.ensureFound(existing, `SchedulingPolicy '${id}' not found`);

    const merged = {
      active: this.resolveUpdatedValue(data.active, existing!.active),
      afterHoursEnabled: this.resolveUpdatedValue(
        data.afterHoursEnabled,
        existing!.afterHoursEnabled
      ),
      bufferMinutes: this.resolveUpdatedValue(data.bufferMinutes, existing!.bufferMinutes),
      customerType: this.resolveUpdatedValue(data.customerType, existing!.customerType),
      defaultMode: this.resolveUpdatedValue(data.defaultMode, existing!.defaultMode),
      maxSameDayMiles: this.resolveUpdatedValue(
        data.maxSameDayMiles,
        existing!.maxSameDayMiles
      ),
      requiresOpsConfirmation: this.resolveUpdatedValue(
        data.requiresOpsConfirmation,
        existing!.requiresOpsConfirmation
      ),
      sameDayCutoffTime: this.resolveUpdatedValue(
        data.sameDayCutoffTime,
        existing!.sameDayCutoffTime
      ),
      serviceType: this.resolveUpdatedValue(data.serviceType, existing!.serviceType),
    };

    this.ensureCustomerType(merged.customerType);
    this.ensureDefaultMode(merged.defaultMode);
    this.ensureOptionalServiceType(merged.serviceType);

    this.ensureNonNegativeInteger(
      merged.bufferMinutes,
      "bufferMinutes must be a non-negative integer"
    );

    if (merged.maxSameDayMiles !== undefined && merged.maxSameDayMiles !== null) {
      this.ensureNonNegativeNumber(
        merged.maxSameDayMiles,
        "maxSameDayMiles must be a non-negative number"
      );
    }

    this.validateSameDayFields(
      merged.defaultMode,
      merged.sameDayCutoffTime,
      merged.maxSameDayMiles
    );
    this.validateCutoffTime(merged.sameDayCutoffTime);

    await this.ensureUniqueActiveCombination(
      client,
      merged.customerType,
      merged.serviceType,
      merged.active,
      id!
    );
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "SchedulingPolicy id is required for delete");

    const existing = await client.schedulingPolicy.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `SchedulingPolicy '${id}' not found`);
  }

  private validateSameDayFields(
    defaultMode: EnumSchedulingPolicyDefaultMode | undefined,
    sameDayCutoffTime: string | null | undefined,
    maxSameDayMiles: number | null | undefined
  ): void {
    if (defaultMode === EnumSchedulingPolicyDefaultMode.SAME_DAY) {
      if (!sameDayCutoffTime) {
        throw new AppException(
          "sameDayCutoffTime is required when defaultMode is SAME_DAY",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }

      if (maxSameDayMiles === undefined || maxSameDayMiles === null) {
        throw new AppException(
          "maxSameDayMiles is required when defaultMode is SAME_DAY",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }
  }

  private validateCutoffTime(value: string | null | undefined): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        "sameDayCutoffTime is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!hhmm.test(value.trim())) {
      throw new AppException(
        "sameDayCutoffTime must be in HH:mm format",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private async ensureUniqueActiveCombination(
    client: PrismaClient,
    customerType: EnumSchedulingPolicyCustomerType,
    serviceType: EnumSchedulingPolicyServiceType | null | undefined,
    active: boolean,
    excludeId?: string
  ): Promise<void> {
    if (!active) {
      return;
    }

    const existing = await client.schedulingPolicy.findFirst({
      where: {
        active: true,
        customerType,
        serviceType: serviceType ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "An active scheduling policy already exists for this customerType and serviceType",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
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

  private ensureCustomerType(value: unknown): void {
    if (
      value !== EnumSchedulingPolicyCustomerType.BUSINESS &&
      value !== EnumSchedulingPolicyCustomerType.PRIVATE
    ) {
      throw new AppException(
        "customerType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureDefaultMode(value: unknown): void {
    if (
      value !== EnumSchedulingPolicyDefaultMode.SAME_DAY &&
      value !== EnumSchedulingPolicyDefaultMode.NEXT_DAY
    ) {
      throw new AppException(
        "defaultMode is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalServiceType(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumSchedulingPolicyServiceType.HOME_DELIVERY &&
      value !== EnumSchedulingPolicyServiceType.BETWEEN_LOCATIONS &&
      value !== EnumSchedulingPolicyServiceType.SERVICE_PICKUP_RETURN
    ) {
      throw new AppException(
        "serviceType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureNonNegativeInteger(value: unknown, message: string): void {
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
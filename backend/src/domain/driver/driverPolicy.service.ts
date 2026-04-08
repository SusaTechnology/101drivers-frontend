// src/domain/driver/driverPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDriverStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DriverPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DriverCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureUserProvided(row);
    this.ensureDriverStatus(row.status);

    if (row.approvedAt && row.status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "approvedAt is only allowed when status is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    const approvedById = this.resolveConnectedId(row.approvedBy);
    if (approvedById && row.status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "approvedBy is only allowed when status is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    this.validateOptionalUrl(row.profilePhotoUrl);

    if (approvedById) {
      await this.ensureUserExists(client, approvedById, "approvedBy");
    }

    if (row.preferences?.connect?.id) {
      throw new AppException(
        "preferences cannot be connected during driver create",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if (row.alerts?.connect?.id) {
      throw new AppException(
        "alerts cannot be connected during driver create",
        ErrorCodes.INVALID_OPERATION
      );
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DriverUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "Driver id is required for update");

    const existing = await client.driver.findUnique({
      where: { id: id! },
      select: {
        id: true,
        userId: true,
        status: true,
        phone: true,
        profilePhotoUrl: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    this.ensureFound(existing, `Driver '${id}' not found`);

    if ("user" in (data as any) || "userId" in (data as any)) {
      throw new AppException(
        "user relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      status: this.resolveUpdatedValue(data.status, existing!.status),
      phone: this.resolveUpdatedValue(data.phone, existing!.phone),
      profilePhotoUrl: this.resolveUpdatedValue(
        data.profilePhotoUrl,
        existing!.profilePhotoUrl
      ),
      approvedAt: this.resolveUpdatedValue(data.approvedAt, existing!.approvedAt),
    };

    this.ensureDriverStatus(merged.status);

    if (merged.approvedAt && merged.status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "approvedAt is only allowed when status is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    this.validateOptionalUrl(merged.profilePhotoUrl);

    const nextApprovedById = this.resolveConnectedId((data as any).approvedBy);
    if (nextApprovedById && merged.status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "approvedBy is only allowed when status is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (nextApprovedById) {
      await this.ensureUserExists(client, nextApprovedById, "approvedBy");
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "Driver id is required for delete");

    const existing = await client.driver.findUnique({
      where: { id: id! },
      select: {
        id: true,
        _count: {
          select: {
            assignments: true,
            audits: true,
            districts: true,
            notifications: true,
            payouts: true,
            ratingsReceived: true,
          },
        },
        preferences: {
          select: { id: true },
        },
        alerts: {
          select: { id: true },
        },
      },
    });

    this.ensureFound(existing, `Driver '${id}' not found`);

    if (
      existing!._count.assignments > 0 ||
      existing!._count.audits > 0 ||
      existing!._count.districts > 0 ||
      existing!._count.notifications > 0 ||
      existing!._count.payouts > 0 ||
      existing!._count.ratingsReceived > 0 ||
      !!existing!.preferences?.id ||
      !!existing!.alerts?.id
    ) {
      throw new AppException(
        "Driver cannot be deleted because related records exist",
        ErrorCodes.STILL_IN_USE,
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

  private ensureDriverStatus(value: unknown): void {
    if (
      value !== EnumDriverStatus.PENDING &&
      value !== EnumDriverStatus.APPROVED &&
      value !== EnumDriverStatus.SUSPENDED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureUserProvided(row: any): void {
    const hasCheckedRelation = !!row?.user;
    const hasUncheckedUserId =
      typeof row?.userId === "string" && row.userId.trim().length > 0;

    if (!hasCheckedRelation && !hasUncheckedUserId) {
      throw new AppException(
        "user is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private async ensureUserExists(
    client: PrismaClient,
    userId: string,
    label: string
  ): Promise<void> {
    const row = await client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `${label} user not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private validateOptionalUrl(value: unknown): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        "profilePhotoUrl is invalid",
        ErrorCodes.INVALID_URL
      );
    }

    try {
      new URL(value);
    } catch {
      throw new AppException(
        "profilePhotoUrl is invalid",
        ErrorCodes.INVALID_URL
      );
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

  private resolveConnectedId(value: any): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return value.connect?.id;
  }
}
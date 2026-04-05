// src/domain/deliveryAssignment/deliveryAssignmentPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDriverStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryAssignmentPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryAssignmentCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const deliveryId = this.resolveRelationId(row.delivery, row.deliveryId);
    const driverId = this.resolveRelationId(row.driver, row.driverId);
    const assignedByUserId = this.resolveRelationId(row.assignedBy, row.assignedByUserId);

    if (!deliveryId) {
      throw new AppException(
        "delivery is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!driverId) {
      throw new AppException(
        "driver is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const delivery = await this.ensureDeliveryExists(client, deliveryId);
    const driver = await this.ensureDriverExists(client, driverId);

    this.validateDeliveryAssignable(delivery.status);
    this.validateDriverAssignable(driver.status);
    this.validateUnassignedAt(row.assignedAt, row.unassignedAt);

    if (assignedByUserId) {
      await this.ensureUserExists(client, assignedByUserId, "assignedBy");
    }

    await this.ensureNoActiveAssignmentForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DeliveryAssignmentUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DeliveryAssignment id is required for update");

    const existing = await client.deliveryAssignment.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        driverId: true,
        assignedByUserId: true,
        assignedAt: true,
        unassignedAt: true,
        reason: true,
        delivery: {
          select: {
            status: true,
          },
        },
        driver: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DeliveryAssignment '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("driver" in (data as any) || "driverId" in (data as any)) {
      throw new AppException(
        "driver relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("assignedBy" in (data as any) || "assignedByUserId" in (data as any)) {
      throw new AppException(
        "assignedBy relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      assignedAt: this.resolveUpdatedValue(data.assignedAt, existing!.assignedAt),
      unassignedAt: this.resolveUpdatedValue(data.unassignedAt, existing!.unassignedAt),
      reason: this.resolveUpdatedValue(data.reason, existing!.reason),
    };

    this.validateDeliveryAssignable(existing!.delivery.status);
    this.validateDriverAssignable(existing!.driver.status);
    this.validateUnassignedAt(merged.assignedAt, merged.unassignedAt);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryAssignment id is required for delete");

    const existing = await client.deliveryAssignment.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DeliveryAssignment '${id}' not found`);
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

  private async ensureDriverExists(client: PrismaClient, driverId: string) {
    const row = await client.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!row) {
      throw new AppException(
        `Driver '${driverId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
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

  private async ensureNoActiveAssignmentForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.deliveryAssignment.findFirst({
      where: {
        deliveryId,
        unassignedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DeliveryRequest already has an active assignment",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAssignable(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.COMPLETED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "DeliveryRequest cannot be assigned in its current status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateDriverAssignable(status: EnumDriverStatus): void {
    if (status !== EnumDriverStatus.APPROVED) {
      throw new AppException(
        "Driver must be APPROVED before assignment",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateUnassignedAt(
    assignedAt: Date | string | undefined,
    unassignedAt: Date | string | null | undefined
  ): void {
    if (unassignedAt === undefined || unassignedAt === null) {
      return;
    }

    const assignedDate = new Date(assignedAt as any);
    const unassignedDate = new Date(unassignedAt as any);

    if (
      Number.isNaN(assignedDate.getTime()) ||
      Number.isNaN(unassignedDate.getTime())
    ) {
      throw new AppException(
        "Assignment dates are invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (unassignedDate < assignedDate) {
      throw new AppException(
        "unassignedAt cannot be earlier than assignedAt",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private resolveRelationId(relation: any, scalar: any): string | undefined {
    if (typeof scalar === "string" && scalar.trim().length > 0) {
      return scalar.trim();
    }

    if (relation?.connect?.id) {
      return relation.connect.id;
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
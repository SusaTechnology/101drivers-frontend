// src/domain/deliveryRating/deliveryRatingPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRatingTarget,
  EnumDeliveryRequestStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryRatingPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryRatingCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const deliveryId = this.resolveRelationId(row.delivery, row.deliveryId);
    if (!deliveryId) {
      throw new AppException(
        "delivery is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const delivery = await this.ensureDeliveryExists(client, deliveryId);

    this.ensureStars(row.stars);
    this.ensureTarget(row.target ?? EnumDeliveryRatingTarget.DRIVER);
    this.validateDeliveryAllowsRating(delivery.status);

    const customerId = this.resolveRelationId(row.customer, row.customerId);
    if (customerId) {
      await this.ensureCustomerExists(client, customerId);

      if (customerId !== delivery.customerId) {
        throw new AppException(
          "customer must match the delivery customer",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    const driverId = this.resolveRelationId(row.driver, row.driverId);
    if (driverId) {
      const assignment = await client.deliveryAssignment.findFirst({
        where: {
          deliveryId,
          driverId,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new AppException(
          "driver must be assigned to the delivery",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (
      (row.target ?? EnumDeliveryRatingTarget.DRIVER) === EnumDeliveryRatingTarget.DRIVER &&
      !driverId
    ) {
      throw new AppException(
        "driver is required when target is DRIVER",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    await this.ensureNoExistingRatingForDelivery(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DeliveryRatingUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DeliveryRating id is required for update");

    const existing = await client.deliveryRating.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        customerId: true,
        driverId: true,
        stars: true,
        comment: true,
        target: true,
        delivery: {
          select: {
            status: true,
            customerId: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DeliveryRating '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("customer" in (data as any) || "customerId" in (data as any)) {
      throw new AppException(
        "customer relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("driver" in (data as any) || "driverId" in (data as any)) {
      throw new AppException(
        "driver relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      stars: this.resolveUpdatedValue(data.stars, existing!.stars),
      target: this.resolveUpdatedValue(data.target, existing!.target),
    };

    this.ensureStars(merged.stars);
    this.ensureTarget(merged.target);
    this.validateDeliveryAllowsRating(existing!.delivery.status);

    if (
      merged.target === EnumDeliveryRatingTarget.DRIVER &&
      !existing!.driverId
    ) {
      throw new AppException(
        "driver is required when target is DRIVER",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryRating id is required for delete");

    const existing = await client.deliveryRating.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DeliveryRating '${id}' not found`);
  }

  private async ensureDeliveryExists(client: PrismaClient, deliveryId: string) {
    const row = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        status: true,
        customerId: true,
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

  private async ensureCustomerExists(
    client: PrismaClient,
    customerId: string
  ): Promise<void> {
    const row = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `Customer '${customerId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async ensureNoExistingRatingForDelivery(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.deliveryRating.findFirst({
      where: {
        deliveryId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DeliveryRating already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsRating(status: EnumDeliveryRequestStatus): void {
    if (status !== EnumDeliveryRequestStatus.COMPLETED) {
      throw new AppException(
        "DeliveryRating is only allowed for COMPLETED deliveries",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private ensureStars(value: unknown): void {
    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

    if (!Number.isInteger(num) || num < 1 || num > 5) {
      throw new AppException(
        "stars must be an integer between 1 and 5",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureTarget(value: unknown): void {
    if (value !== EnumDeliveryRatingTarget.DRIVER) {
      throw new AppException(
        "target is invalid",
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
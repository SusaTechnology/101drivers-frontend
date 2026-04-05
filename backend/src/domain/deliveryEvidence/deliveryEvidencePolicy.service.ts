// src/domain/deliveryEvidence/deliveryEvidencePolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryEvidencePhase,
  EnumDeliveryEvidenceType,
  EnumDeliveryRequestStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryEvidencePolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryEvidenceCreateArgs["data"]
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

    this.ensureEvidenceType(row.type);
    this.ensureOptionalPhase(row.phase);
    this.ensureOptionalSlotIndex(row.slotIndex);
    this.validateValuePayload(row.imageUrl, row.value);
    this.validateTypePhaseCompatibility(row.type, row.phase);
    this.validateDeliveryEvidenceAllowed(delivery.status);

    await this.ensureUniqueEvidenceKey(
      client,
      deliveryId,
      row.phase ?? null,
      row.type,
      row.slotIndex ?? null
    );
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DeliveryEvidenceUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DeliveryEvidence id is required for update");

    const existing = await client.deliveryEvidence.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        type: true,
        phase: true,
        slotIndex: true,
        imageUrl: true,
        value: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `DeliveryEvidence '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      type: this.resolveUpdatedValue(data.type, existing!.type),
      phase: this.resolveUpdatedValue(data.phase, existing!.phase),
      slotIndex: this.resolveUpdatedValue(data.slotIndex, existing!.slotIndex),
      imageUrl: this.resolveUpdatedValue(data.imageUrl, existing!.imageUrl),
      value: this.resolveUpdatedValue(data.value, existing!.value),
    };

    this.ensureEvidenceType(merged.type);
    this.ensureOptionalPhase(merged.phase);
    this.ensureOptionalSlotIndex(merged.slotIndex);
    this.validateValuePayload(merged.imageUrl, merged.value);
    this.validateTypePhaseCompatibility(merged.type, merged.phase);
    this.validateDeliveryEvidenceAllowed(existing!.delivery.status);

    const uniqueKeyChanged =
      merged.type !== existing!.type ||
      merged.phase !== existing!.phase ||
      merged.slotIndex !== existing!.slotIndex;

    if (uniqueKeyChanged) {
      await this.ensureUniqueEvidenceKey(
        client,
        existing!.deliveryId,
        merged.phase ?? null,
        merged.type,
        merged.slotIndex ?? null,
        id!
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryEvidence id is required for delete");

    const existing = await client.deliveryEvidence.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DeliveryEvidence '${id}' not found`);
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

  private async ensureUniqueEvidenceKey(
    client: PrismaClient,
    deliveryId: string,
    phase: EnumDeliveryEvidencePhase | null,
    type: EnumDeliveryEvidenceType,
    slotIndex: number | null,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.deliveryEvidence.findFirst({
      where: {
        deliveryId,
        phase,
        type,
        slotIndex,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "DeliveryEvidence already exists for this delivery, phase, type, and slotIndex",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryEvidenceAllowed(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.QUOTED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "DeliveryEvidence is not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateValuePayload(
    imageUrl: string | null | undefined,
    value: string | null | undefined
  ): void {
    if (
      (imageUrl === undefined || imageUrl === null || imageUrl === "") &&
      (value === undefined || value === null || value === "")
    ) {
      throw new AppException(
        "Either imageUrl or value is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateTypePhaseCompatibility(
    type: EnumDeliveryEvidenceType,
    phase: EnumDeliveryEvidencePhase | null | undefined
  ): void {
    if (
      type === EnumDeliveryEvidenceType.PICKUP_PHOTO ||
      type === EnumDeliveryEvidenceType.ODOMETER_START
    ) {
      if (phase !== EnumDeliveryEvidencePhase.PICKUP) {
        throw new AppException(
          "phase must be PICKUP for this evidence type",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (
      type === EnumDeliveryEvidenceType.DROPOFF_PHOTO ||
      type === EnumDeliveryEvidenceType.ODOMETER_END
    ) {
      if (phase !== EnumDeliveryEvidencePhase.DROPOFF) {
        throw new AppException(
          "phase must be DROPOFF for this evidence type",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (type === EnumDeliveryEvidenceType.VIN_CONFIRMATION) {
      if (
        phase !== undefined &&
        phase !== null &&
        phase !== EnumDeliveryEvidencePhase.PICKUP &&
        phase !== EnumDeliveryEvidencePhase.DROPOFF
      ) {
        throw new AppException(
          "phase is invalid for VIN_CONFIRMATION",
          ErrorCodes.VALIDATION_ERROR
        );
      }
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

  private ensureEvidenceType(value: unknown): void {
    if (
      value !== EnumDeliveryEvidenceType.PICKUP_PHOTO &&
      value !== EnumDeliveryEvidenceType.DROPOFF_PHOTO &&
      value !== EnumDeliveryEvidenceType.ODOMETER_START &&
      value !== EnumDeliveryEvidenceType.ODOMETER_END &&
      value !== EnumDeliveryEvidenceType.VIN_CONFIRMATION
    ) {
      throw new AppException(
        "type is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalPhase(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumDeliveryEvidencePhase.PICKUP &&
      value !== EnumDeliveryEvidencePhase.DROPOFF
    ) {
      throw new AppException(
        "phase is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalSlotIndex(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isInteger(num) || num < 0) {
      throw new AppException(
        "slotIndex must be a non-negative integer",
        ErrorCodes.VALIDATION_ERROR
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
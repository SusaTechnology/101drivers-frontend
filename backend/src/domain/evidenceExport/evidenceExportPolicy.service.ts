// src/domain/evidenceExport/evidenceExportPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class EvidenceExportPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.EvidenceExportCreateArgs["data"]
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
    this.validateDeliveryAllowsExport(delivery.status);

    const createdByUserId = this.resolveRelationId(row.createdBy, row.createdByUserId);
    if (createdByUserId) {
      await this.ensureUserExists(client, createdByUserId, "createdBy");
    }

    this.validateOptionalUrl(row.url);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.EvidenceExportUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "EvidenceExport id is required for update");

    const existing = await client.evidenceExport.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        createdByUserId: true,
        url: true,
        metaJson: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `EvidenceExport '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("createdBy" in (data as any) || "createdByUserId" in (data as any)) {
      throw new AppException(
        "createdBy relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      url: this.resolveUpdatedValue(data.url, existing!.url),
    };

    this.validateDeliveryAllowsExport(existing!.delivery.status);
    this.validateOptionalUrl(merged.url);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "EvidenceExport id is required for delete");

    const existing = await client.evidenceExport.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `EvidenceExport '${id}' not found`);
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

  private validateDeliveryAllowsExport(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.DRAFT ||
      status === EnumDeliveryRequestStatus.QUOTED
    ) {
      throw new AppException(
        "EvidenceExport is not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateOptionalUrl(value: unknown): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        "url is invalid",
        ErrorCodes.INVALID_URL
      );
    }

    try {
      new URL(value);
    } catch {
      throw new AppException(
        "url is invalid",
        ErrorCodes.INVALID_URL
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
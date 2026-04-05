import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumSupportStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class SupportRequestPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.SupportRequestCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureActorRole(row.actorRole);
    this.ensureActorType(row.actorType);
    this.ensureCategory(row.category);
    this.ensurePriority(row.priority);
    this.ensureStatus(row.status ?? EnumSupportStatus.OPEN);
    this.ensureRequiredString(row.message, "message is required");
    this.ensureOptionalString(row.subject, "subject");

    const userId = this.resolveUserId(row);
    if (userId) {
      await this.ensureUserExists(client, userId, "userId");
    }

    const assignedToUserId = this.resolveAssignedToUserId(row);
    if (assignedToUserId) {
      await this.ensureUserExists(client, assignedToUserId, "assignedToUserId");
    }

    const deliveryId = this.resolveDeliveryId(row);
    if (deliveryId) {
      await this.ensureDeliveryExists(client, deliveryId);
    }

    const status = row.status ?? EnumSupportStatus.OPEN;
    if (status === EnumSupportStatus.RESOLVED || status === EnumSupportStatus.CLOSED) {
      throw new AppException(
        "SupportRequest cannot be created directly as RESOLVED or CLOSED",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.SupportRequestUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "SupportRequest id is required for update");

    const existing = await client.supportRequest.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
        assignedToUserId: true,
        deliveryId: true,
        resolvedAt: true,
        closedAt: true,
      },
    });

    this.ensureFound(existing, `SupportRequest '${id}' not found`);

    const row = data as any;

    if (row.user || row.userId) {
      throw new AppException(
        "user relation cannot be changed",
        ErrorCodes.INVALID_OPERATION,
        HttpStatus.CONFLICT
      );
    }

    if (row.delivery || row.deliveryId) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION,
        HttpStatus.CONFLICT
      );
    }

    const nextStatus = this.resolveScalar(row.status, existing!.status);
    this.ensureStatus(nextStatus);

    const assignedToUserId = this.resolveAssignedToUserId(row) ?? existing!.assignedToUserId;
    if (assignedToUserId) {
      await this.ensureUserExists(client, assignedToUserId, "assignedToUserId");
    }

    this.ensureOptionalString(this.resolveScalar(row.subject, undefined), "subject");
    this.ensureOptionalString(this.resolveScalar(row.message, undefined), "message");

    if (
      existing!.status === EnumSupportStatus.CLOSED &&
      nextStatus !== EnumSupportStatus.CLOSED
    ) {
      throw new AppException(
        "Closed SupportRequest cannot be reopened",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }

    if (
      existing!.status === EnumSupportStatus.RESOLVED &&
      nextStatus === EnumSupportStatus.OPEN
    ) {
      throw new AppException(
        "Resolved SupportRequest cannot move back to OPEN",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "SupportRequest id is required for delete");

    const existing = await client.supportRequest.findUnique({
      where: { id: id! },
      select: {
        id: true,
        _count: {
          select: {
            notes: true,
          },
        },
      },
    });

    this.ensureFound(existing, `SupportRequest '${id}' not found`);

    if ((existing?._count?.notes ?? 0) > 0) {
      throw new AppException(
        "SupportRequest with notes cannot be deleted",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureUserExists(
    client: PrismaClient,
    userId: string,
    fieldName: string
  ): Promise<void> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppException(
        `${fieldName} '${userId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async ensureDeliveryExists(
    client: PrismaClient,
    deliveryId: string
  ): Promise<void> {
    const delivery = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true },
    });

    if (!delivery) {
      throw new AppException(
        `deliveryId '${deliveryId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private ensureActorRole(value: unknown): void {
    if (!value) {
      throw new AppException(
        "actorRole is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureActorType(value: unknown): void {
    if (!value) {
      throw new AppException(
        "actorType is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureCategory(value: unknown): void {
    if (!value) {
      throw new AppException(
        "category is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensurePriority(value: unknown): void {
    if (!value) {
      throw new AppException(
        "priority is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureStatus(value: unknown): void {
    if (!value) {
      throw new AppException(
        "status is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureOptionalString(value: unknown, fieldName: string): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        `${fieldName} must be a string`,
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

  private resolveUserId(row: any): string | undefined {
    if (typeof row?.userId === "string" && row.userId.trim()) {
      return row.userId.trim();
    }
    if (row?.user?.connect?.id) {
      return row.user.connect.id;
    }
    return undefined;
  }

  private resolveAssignedToUserId(row: any): string | undefined {
    if (typeof row?.assignedToUserId === "string" && row.assignedToUserId.trim()) {
      return row.assignedToUserId.trim();
    }
    if (row?.assignedTo?.connect?.id) {
      return row.assignedTo.connect.id;
    }
    return undefined;
  }

  private resolveDeliveryId(row: any): string | undefined {
    if (typeof row?.deliveryId === "string" && row.deliveryId.trim()) {
      return row.deliveryId.trim();
    }
    if (row?.delivery?.connect?.id) {
      return row.delivery.connect.id;
    }
    return undefined;
  }

  private resolveScalar<T>(value: any, fallback: T): T {
    if (value === undefined) {
      return fallback;
    }

    if (value && typeof value === "object" && "set" in value) {
      return value.set;
    }

    return value;
  }
}
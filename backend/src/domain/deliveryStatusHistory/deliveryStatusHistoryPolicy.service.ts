// src/domain/deliveryStatusHistory/deliveryStatusHistoryPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumDeliveryStatusHistoryActorRole,
  EnumDeliveryStatusHistoryActorType,
  EnumDeliveryStatusHistoryFromStatus,
  EnumDeliveryStatusHistoryToStatus,
  EnumUserRoles,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryStatusHistoryPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryStatusHistoryCreateArgs["data"]
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

    this.ensureToStatus(row.toStatus);
    this.ensureOptionalFromStatus(row.fromStatus);
    this.ensureActorType(row.actorType ?? EnumDeliveryStatusHistoryActorType.USER);
    this.ensureOptionalActorRole(row.actorRole);

    this.validateFromStatusAgainstDelivery(row.fromStatus, delivery.status);
    this.validateTransition(row.fromStatus, row.toStatus);
    this.validateActorFields(row.actorType, row.actorRole, row.actor, row.actorUserId);

    const actorUserId = this.resolveRelationId(row.actor, row.actorUserId);
    if (actorUserId) {
      const actor = await this.ensureUserExists(client, actorUserId, "actor");
      this.validateActorRoleConsistency(actor.roles, row.actorRole);
    }
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.DeliveryStatusHistoryUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "DeliveryStatusHistory id is required for update");

    const existing = await client.deliveryStatusHistory.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        actorUserId: true,
        actorType: true,
        actorRole: true,
        fromStatus: true,
        toStatus: true,
      },
    });

    this.ensureFound(existing, `DeliveryStatusHistory '${id}' not found`);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("actor" in (data as any) || "actorUserId" in (data as any)) {
      throw new AppException(
        "actor relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      actorType: this.resolveUpdatedValue(data.actorType, existing!.actorType),
      actorRole: this.resolveUpdatedValue(data.actorRole, existing!.actorRole),
      fromStatus: this.resolveUpdatedValue(data.fromStatus, existing!.fromStatus),
      toStatus: this.resolveUpdatedValue(data.toStatus, existing!.toStatus),
      note: this.resolveUpdatedValue(data.note, null),
    };

    this.ensureActorType(merged.actorType);
    this.ensureOptionalActorRole(merged.actorRole);
    this.ensureOptionalFromStatus(merged.fromStatus);
    this.ensureToStatus(merged.toStatus);

    this.validateTransition(merged.fromStatus, merged.toStatus);

    if (
      merged.actorType === EnumDeliveryStatusHistoryActorType.SYSTEM &&
      existing!.actorUserId
    ) {
      throw new AppException(
        "SYSTEM actorType cannot have actorUserId",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryStatusHistory id is required for delete");

    const existing = await client.deliveryStatusHistory.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `DeliveryStatusHistory '${id}' not found`);
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
  ) {
    const row = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: true,
      },
    });

    if (!row) {
      throw new AppException(
        `${label} user not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private validateFromStatusAgainstDelivery(
    fromStatus: EnumDeliveryStatusHistoryFromStatus | null | undefined,
    currentStatus: EnumDeliveryRequestStatus
  ): void {
    if (!fromStatus) {
      return;
    }

    if (fromStatus !== currentStatus) {
      throw new AppException(
        "fromStatus must match the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateActorFields(
    actorType: EnumDeliveryStatusHistoryActorType | undefined,
    actorRole: EnumDeliveryStatusHistoryActorRole | null | undefined,
    actor: any,
    actorUserId: string | undefined
  ): void {
    const resolvedActorUserId = this.resolveRelationId(actor, actorUserId);

    if (actorType === EnumDeliveryStatusHistoryActorType.SYSTEM) {
      if (resolvedActorUserId) {
        throw new AppException(
          "SYSTEM actorType cannot have an actor user",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
      if (actorRole) {
        throw new AppException(
          "SYSTEM actorType cannot have actorRole",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
      return;
    }

    if (actorType === EnumDeliveryStatusHistoryActorType.USER && !resolvedActorUserId) {
      throw new AppException(
        "actor is required when actorType is USER",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateActorRoleConsistency(
    role: EnumUserRoles,
    actorRole: EnumDeliveryStatusHistoryActorRole | null | undefined
  ): void {
    if (!actorRole) {
      return;
    }

    const map: Record<EnumUserRoles, EnumDeliveryStatusHistoryActorRole> = {
      PRIVATE_CUSTOMER: EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER,
      BUSINESS_CUSTOMER: EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER,
      DRIVER: EnumDeliveryStatusHistoryActorRole.DRIVER,
      ADMIN: EnumDeliveryStatusHistoryActorRole.ADMIN,
    };

    if (map[role] !== actorRole) {
      throw new AppException(
        "actorRole does not match the actor user's role",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateTransition(
    fromStatus: EnumDeliveryStatusHistoryFromStatus | null | undefined,
    toStatus: EnumDeliveryStatusHistoryToStatus
  ): void {
    if (!fromStatus) {
      return;
    }

    const allowed: Record<
      EnumDeliveryStatusHistoryFromStatus,
      EnumDeliveryStatusHistoryToStatus[]
    > = {
      DRAFT: ["QUOTED", "CANCELLED", "EXPIRED", "DRAFT"],
      QUOTED: ["LISTED", "BOOKED", "CANCELLED", "EXPIRED", "QUOTED"],
      LISTED: ["BOOKED", "CANCELLED", "EXPIRED", "LISTED"],
      BOOKED: ["ACTIVE", "CANCELLED", "DISPUTED", "BOOKED"],
      ACTIVE: ["COMPLETED", "CANCELLED", "DISPUTED", "ACTIVE"],
      COMPLETED: ["DISPUTED", "COMPLETED"],
      CANCELLED: ["CANCELLED"],
      EXPIRED: ["EXPIRED"],
      DISPUTED: ["ACTIVE", "COMPLETED", "CANCELLED", "DISPUTED"],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "Delivery status transition is invalid",
        ErrorCodes.BUSINESS_RULE_VIOLATION
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

  private ensureActorType(value: unknown): void {
    if (
      value !== EnumDeliveryStatusHistoryActorType.USER &&
      value !== EnumDeliveryStatusHistoryActorType.SYSTEM
    ) {
      throw new AppException(
        "actorType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalActorRole(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumDeliveryStatusHistoryActorRole.PRIVATE_CUSTOMER &&
      value !== EnumDeliveryStatusHistoryActorRole.BUSINESS_CUSTOMER &&
      value !== EnumDeliveryStatusHistoryActorRole.DRIVER &&
      value !== EnumDeliveryStatusHistoryActorRole.ADMIN
    ) {
      throw new AppException(
        "actorRole is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalFromStatus(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumDeliveryStatusHistoryFromStatus.DRAFT &&
      value !== EnumDeliveryStatusHistoryFromStatus.QUOTED &&
      value !== EnumDeliveryStatusHistoryFromStatus.LISTED &&
      value !== EnumDeliveryStatusHistoryFromStatus.BOOKED &&
      value !== EnumDeliveryStatusHistoryFromStatus.ACTIVE &&
      value !== EnumDeliveryStatusHistoryFromStatus.COMPLETED &&
      value !== EnumDeliveryStatusHistoryFromStatus.CANCELLED &&
      value !== EnumDeliveryStatusHistoryFromStatus.EXPIRED &&
      value !== EnumDeliveryStatusHistoryFromStatus.DISPUTED
    ) {
      throw new AppException(
        "fromStatus is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureToStatus(value: unknown): void {
    if (
      value !== EnumDeliveryStatusHistoryToStatus.DRAFT &&
      value !== EnumDeliveryStatusHistoryToStatus.QUOTED &&
      value !== EnumDeliveryStatusHistoryToStatus.LISTED &&
      value !== EnumDeliveryStatusHistoryToStatus.BOOKED &&
      value !== EnumDeliveryStatusHistoryToStatus.ACTIVE &&
      value !== EnumDeliveryStatusHistoryToStatus.COMPLETED &&
      value !== EnumDeliveryStatusHistoryToStatus.CANCELLED &&
      value !== EnumDeliveryStatusHistoryToStatus.EXPIRED &&
      value !== EnumDeliveryStatusHistoryToStatus.DISPUTED
    ) {
      throw new AppException(
        "toStatus is invalid",
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
// src/domain/adminAuditLog/adminAuditLogPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class AdminAuditLogPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.AdminAuditLogCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureAction(row.action);
    this.ensureActorType(row.actorType ?? EnumAdminAuditLogActorType.USER);

    const actorUserId = this.resolveRelationId(row.actor, row.actorUserId);
    const targetUserId = this.resolveRelationId(row.user, row.userId);
    const customerId = this.resolveRelationId(row.customer, row.customerId);
    const deliveryId = this.resolveRelationId(row.delivery, row.deliveryId);
    const driverId = this.resolveRelationId(row.driver, row.driverId);

    this.validateActorFields(row.actorType ?? EnumAdminAuditLogActorType.USER, actorUserId);
    this.validateTargetScope(targetUserId, customerId, deliveryId, driverId);

    if (actorUserId) {
      await this.ensureUserExists(client, actorUserId, "actor");
    }

    if (targetUserId) {
      await this.ensureUserExists(client, targetUserId, "user");
    }

    if (customerId) {
      await this.ensureCustomerExists(client, customerId);
    }

    if (deliveryId) {
      await this.ensureDeliveryExists(client, deliveryId);
    }

    if (driverId) {
      await this.ensureDriverExists(client, driverId);
    }

    this.validateReasonForAction(row.action, row.reason);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.AdminAuditLogUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "AdminAuditLog id is required for update");

    const existing = await client.adminAuditLog.findUnique({
      where: { id: id! },
      select: {
        id: true,
        action: true,
        actorUserId: true,
        actorType: true,
        userId: true,
        customerId: true,
        deliveryId: true,
        driverId: true,
        reason: true,
      },
    });

    this.ensureFound(existing, `AdminAuditLog '${id}' not found`);

    if ("actor" in (data as any) || "actorUserId" in (data as any)) {
      throw new AppException(
        "actor relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("user" in (data as any) || "userId" in (data as any)) {
      throw new AppException(
        "user relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("customer" in (data as any) || "customerId" in (data as any)) {
      throw new AppException(
        "customer relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

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

    const merged = {
      action: this.resolveUpdatedValue(data.action, existing!.action),
      actorType: this.resolveUpdatedValue(data.actorType, existing!.actorType),
      reason: this.resolveUpdatedValue(data.reason, existing!.reason),
    };

    this.ensureAction(merged.action);
    this.ensureActorType(merged.actorType);
    this.validateActorFields(merged.actorType, existing!.actorUserId ?? undefined);
    this.validateTargetScope(
      existing!.userId ?? undefined,
      existing!.customerId ?? undefined,
      existing!.deliveryId ?? undefined,
      existing!.driverId ?? undefined
    );
    this.validateReasonForAction(merged.action, merged.reason);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "AdminAuditLog id is required for delete");

    const existing = await client.adminAuditLog.findUnique({
      where: { id: id! },
      select: { id: true },
    });

    this.ensureFound(existing, `AdminAuditLog '${id}' not found`);
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

  private async ensureDeliveryExists(
    client: PrismaClient,
    deliveryId: string
  ): Promise<void> {
    const row = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `DeliveryRequest '${deliveryId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private async ensureDriverExists(
    client: PrismaClient,
    driverId: string
  ): Promise<void> {
    const row = await client.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `Driver '${driverId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private validateActorFields(
    actorType: EnumAdminAuditLogActorType,
    actorUserId?: string
  ): void {
    if (actorType === EnumAdminAuditLogActorType.USER && !actorUserId) {
      throw new AppException(
        "actor is required when actorType is USER",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (actorType === EnumAdminAuditLogActorType.SYSTEM && actorUserId) {
      throw new AppException(
        "actor is not allowed when actorType is SYSTEM",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateTargetScope(
    userId?: string,
    customerId?: string,
    deliveryId?: string,
    driverId?: string
  ): void {
    if (!userId && !customerId && !deliveryId && !driverId) {
      throw new AppException(
        "At least one target relation is required: user, customer, delivery, or driver",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateReasonForAction(
    action: EnumAdminAuditLogAction,
    reason: string | null | undefined
  ): void {
    const actionsRequiringReason = new Set<EnumAdminAuditLogAction>([
      EnumAdminAuditLogAction.USER_DISABLE,
      EnumAdminAuditLogAction.DEALER_REJECT,
      EnumAdminAuditLogAction.DRIVER_SUSPEND,
      EnumAdminAuditLogAction.DELIVERY_CANCEL,
      EnumAdminAuditLogAction.DELIVERY_REASSIGN,
      EnumAdminAuditLogAction.DISPUTE_UPDATE,
      EnumAdminAuditLogAction.PAYMENT_OVERRIDE,
      EnumAdminAuditLogAction.PAYOUT_OVERRIDE,
      EnumAdminAuditLogAction.OTHER,
    ]);

    if (actionsRequiringReason.has(action)) {
      if (!reason || String(reason).trim().length === 0) {
        throw new AppException(
          "reason is required for this audit action",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
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

  private ensureAction(value: unknown): void {
    if (
      value !== EnumAdminAuditLogAction.USER_DISABLE &&
      value !== EnumAdminAuditLogAction.USER_ENABLE &&
      value !== EnumAdminAuditLogAction.DEALER_APPROVE &&
      value !== EnumAdminAuditLogAction.DEALER_REJECT &&
      value !== EnumAdminAuditLogAction.DRIVER_APPROVE &&
      value !== EnumAdminAuditLogAction.DRIVER_SUSPEND &&
      value !== EnumAdminAuditLogAction.DRIVER_UNSUSPEND &&
      value !== EnumAdminAuditLogAction.DELIVERY_CANCEL &&
      value !== EnumAdminAuditLogAction.DELIVERY_REASSIGN &&
      value !== EnumAdminAuditLogAction.PRICING_UPDATE &&
      value !== EnumAdminAuditLogAction.POLICY_UPDATE &&
      value !== EnumAdminAuditLogAction.DISPUTE_UPDATE &&
      value !== EnumAdminAuditLogAction.PAYMENT_OVERRIDE &&
      value !== EnumAdminAuditLogAction.PAYOUT_OVERRIDE &&
      value !== EnumAdminAuditLogAction.OTHER
    ) {
      throw new AppException(
        "action is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureActorType(value: unknown): void {
    if (
      value !== EnumAdminAuditLogActorType.USER &&
      value !== EnumAdminAuditLogActorType.SYSTEM
    ) {
      throw new AppException(
        "actorType is invalid",
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
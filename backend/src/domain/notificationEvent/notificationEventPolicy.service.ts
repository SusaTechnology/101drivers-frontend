import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumNotificationEventChannel,
  EnumNotificationEventStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class NotificationEventPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.NotificationEventCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureChannel(row.channel);
    this.ensureType(row.type);
    this.ensureStatus(row.status ?? EnumNotificationEventStatus.QUEUED);

    const actorUserId = this.resolveRelationId(row.actor, row.actorUserId);
    const customerId = this.resolveRelationId(row.customer, row.customerId);
    const deliveryId = this.resolveRelationId(row.delivery, row.deliveryId);
    const driverId = this.resolveRelationId(row.driver, row.driverId);

    if (actorUserId) {
      await this.ensureUserExists(client, actorUserId, "actor");
    }

    if (customerId) {
      await this.ensureCustomerExists(client, customerId);
    }

    if (deliveryId) {
      const delivery = await this.ensureDeliveryExists(client, deliveryId);

      if (customerId && delivery.customerId !== customerId) {
        throw new AppException(
          "customer must match the delivery customer",
          ErrorCodes.RELATION_CONFLICT
        );
      }
    }

    if (driverId) {
      await this.ensureDriverExists(client, driverId);
    }

    this.validateRecipientFields(row.channel, row.toEmail, row.toPhone);
    this.validateStatusFields(
      row.status ?? EnumNotificationEventStatus.QUEUED,
      row.sentAt,
      row.failedAt,
      row.errorMessage
    );
    this.validateNotificationScope(customerId, deliveryId, driverId);
    this.validateReadTrackingFields({
      isRead: row.isRead,
      seenInListAt: row.seenInListAt,
      openedAt: row.openedAt,
      readAt: row.readAt,
      clickedAt: row.clickedAt,
      archivedAt: row.archivedAt,
      dismissedAt: row.dismissedAt,
      expiresAt: row.expiresAt,
    });
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.NotificationEventUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "NotificationEvent id is required for update");

    const existing = await client.notificationEvent.findUnique({
      where: { id: id! },
      select: {
        id: true,
        actorUserId: true,
        customerId: true,
        deliveryId: true,
        driverId: true,
        channel: true,
        type: true,
        status: true,
        subject: true,
        body: true,
        templateCode: true,
        toEmail: true,
        toPhone: true,
        errorMessage: true,
        sentAt: true,
        failedAt: true,

        isRead: true,
        seenInListAt: true,
        openedAt: true,
        readAt: true,
        clickedAt: true,
        archivedAt: true,
        dismissedAt: true,
        expiresAt: true,
      },
    });

    this.ensureFound(existing, `NotificationEvent '${id}' not found`);

    if ("actor" in (data as any) || "actorUserId" in (data as any)) {
      throw new AppException(
        "actor relation cannot be changed",
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
      channel: this.resolveUpdatedValue(data.channel, existing!.channel),
      type: this.resolveUpdatedValue(data.type, existing!.type),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      toEmail: this.resolveUpdatedValue(data.toEmail, existing!.toEmail),
      toPhone: this.resolveUpdatedValue(data.toPhone, existing!.toPhone),
      errorMessage: this.resolveUpdatedValue(data.errorMessage, existing!.errorMessage),
      sentAt: this.resolveUpdatedValue(data.sentAt, existing!.sentAt),
      failedAt: this.resolveUpdatedValue(data.failedAt, existing!.failedAt),

      isRead: this.resolveUpdatedValue(data.isRead, existing!.isRead),
      seenInListAt: this.resolveUpdatedValue(data.seenInListAt, existing!.seenInListAt),
      openedAt: this.resolveUpdatedValue(data.openedAt, existing!.openedAt),
      readAt: this.resolveUpdatedValue(data.readAt, existing!.readAt),
      clickedAt: this.resolveUpdatedValue(data.clickedAt, existing!.clickedAt),
      archivedAt: this.resolveUpdatedValue(data.archivedAt, existing!.archivedAt),
      dismissedAt: this.resolveUpdatedValue(data.dismissedAt, existing!.dismissedAt),
      expiresAt: this.resolveUpdatedValue(data.expiresAt, existing!.expiresAt),
    };

    this.ensureChannel(merged.channel);
    this.ensureType(merged.type);
    this.ensureStatus(merged.status);

    this.validateRecipientFields(merged.channel, merged.toEmail, merged.toPhone);
    this.validateStatusFields(
      merged.status,
      merged.sentAt,
      merged.failedAt,
      merged.errorMessage
    );
    this.validateStatusTransition(existing!.status, merged.status);
    this.validateReadTrackingFields({
      isRead: merged.isRead,
      seenInListAt: merged.seenInListAt,
      openedAt: merged.openedAt,
      readAt: merged.readAt,
      clickedAt: merged.clickedAt,
      archivedAt: merged.archivedAt,
      dismissedAt: merged.dismissedAt,
      expiresAt: merged.expiresAt,
    });
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "NotificationEvent id is required for delete");

    const existing = await client.notificationEvent.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
      },
    });

    this.ensureFound(existing, `NotificationEvent '${id}' not found`);

    if (existing!.status === EnumNotificationEventStatus.SENT) {
      throw new AppException(
        "Sent notification events cannot be deleted",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
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
  ) {
    const row = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
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

  private validateRecipientFields(
    channel: EnumNotificationEventChannel,
    toEmail: string | null | undefined,
    toPhone: string | null | undefined
  ): void {
    if (channel === EnumNotificationEventChannel.EMAIL) {
      if (!toEmail || String(toEmail).trim().length === 0) {
        throw new AppException(
          "toEmail is required when channel is EMAIL",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (channel === EnumNotificationEventChannel.SMS) {
      if (!toPhone || String(toPhone).trim().length === 0) {
        throw new AppException(
          "toPhone is required when channel is SMS",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }
  }

  private validateStatusFields(
    status: EnumNotificationEventStatus,
    sentAt: Date | string | null | undefined,
    failedAt: Date | string | null | undefined,
    errorMessage: string | null | undefined
  ): void {
    if (status === EnumNotificationEventStatus.SENT && !sentAt) {
      throw new AppException(
        "sentAt is required when status is SENT",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (status === EnumNotificationEventStatus.FAILED && !failedAt) {
      throw new AppException(
        "failedAt is required when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (status === EnumNotificationEventStatus.FAILED) {
      if (!errorMessage || String(errorMessage).trim().length === 0) {
        throw new AppException(
          "errorMessage is required when status is FAILED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }

    if (sentAt && status !== EnumNotificationEventStatus.SENT) {
      throw new AppException(
        "sentAt is only allowed when status is SENT",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (failedAt && status !== EnumNotificationEventStatus.FAILED) {
      throw new AppException(
        "failedAt is only allowed when status is FAILED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateReadTrackingFields(input: {
    isRead?: boolean | null;
    seenInListAt?: Date | string | null;
    openedAt?: Date | string | null;
    readAt?: Date | string | null;
    clickedAt?: Date | string | null;
    archivedAt?: Date | string | null;
    dismissedAt?: Date | string | null;
    expiresAt?: Date | string | null;
  }): void {
    if (input.readAt && input.isRead === false) {
      throw new AppException(
        "isRead cannot be false when readAt is set",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (input.openedAt && !input.seenInListAt) {
      // allowed; opening can happen directly
    }

    if (input.archivedAt && input.dismissedAt) {
      throw new AppException(
        "NotificationEvent cannot be archived and dismissed at the same time",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateNotificationScope(
    customerId?: string,
    deliveryId?: string,
    driverId?: string
  ): void {
    if (!customerId && !deliveryId && !driverId) {
      throw new AppException(
        "At least one target relation is required: customer, delivery, or driver",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumNotificationEventStatus,
    toStatus: EnumNotificationEventStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<EnumNotificationEventStatus, EnumNotificationEventStatus[]> = {
      QUEUED: [EnumNotificationEventStatus.SENT, EnumNotificationEventStatus.FAILED],
      SENT: [EnumNotificationEventStatus.SENT],
      FAILED: [EnumNotificationEventStatus.FAILED],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "NotificationEvent status transition is invalid",
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

  private ensureChannel(value: unknown): void {
    if (
      value !== EnumNotificationEventChannel.EMAIL &&
      value !== EnumNotificationEventChannel.SMS
    ) {
      throw new AppException(
        "channel is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureType(value: unknown): void {
    if (!value) {
      throw new AppException("type is invalid", ErrorCodes.VALIDATION_ERROR);
    }
  }

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumNotificationEventStatus.QUEUED &&
      value !== EnumNotificationEventStatus.SENT &&
      value !== EnumNotificationEventStatus.FAILED
    ) {
      throw new AppException(
        "status is invalid",
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
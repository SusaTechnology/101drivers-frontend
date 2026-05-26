// src/domain/scheduleChangeRequest/scheduleChangeRequestPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumDeliveryRequestStatus,
  EnumScheduleChangeRequestRequestedByRole,
  EnumScheduleChangeRequestStatus,
  EnumUserRoles,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class ScheduleChangeRequestPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.ScheduleChangeRequestCreateArgs["data"]
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
    this.validateDeliveryAllowsScheduleChange(delivery.status);

    this.ensureStatus(row.status ?? EnumScheduleChangeRequestStatus.PENDING);
    this.ensureOptionalRequestedByRole(row.requestedByRole);

    this.validateProposedWindows(
      row.proposedPickupWindowStart,
      row.proposedPickupWindowEnd,
      row.proposedDropoffWindowStart,
      row.proposedDropoffWindowEnd
    );

    this.validateDecisionFields(
      row.status ?? EnumScheduleChangeRequestStatus.PENDING,
      row.decidedAt,
      row.decidedBy,
      row.decidedByUserId,
      row.decisionNote
    );

    const requestedByUserId = this.resolveRelationId(row.requestedBy, row.requestedByUserId);
    if (requestedByUserId) {
      const requestedBy = await this.ensureUserExists(client, requestedByUserId, "requestedBy");
      this.validateRequestedByRoleConsistency(requestedBy.roles, row.requestedByRole);
    }

    const decidedByUserId = this.resolveRelationId(row.decidedBy, row.decidedByUserId);
    if (decidedByUserId) {
      await this.ensureUserExists(client, decidedByUserId, "decidedBy");
    }

    await this.ensureNoActivePendingRequest(client, deliveryId);
  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.ScheduleChangeRequestUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "ScheduleChangeRequest id is required for update");

    const existing = await client.scheduleChangeRequest.findUnique({
      where: { id: id! },
      select: {
        id: true,
        deliveryId: true,
        requestedByUserId: true,
        requestedByRole: true,
        decidedByUserId: true,
        status: true,
        reason: true,
        decisionNote: true,
        proposedPickupWindowStart: true,
        proposedPickupWindowEnd: true,
        proposedDropoffWindowStart: true,
        proposedDropoffWindowEnd: true,
        decidedAt: true,
        delivery: {
          select: {
            status: true,
          },
        },
      },
    });

    this.ensureFound(existing, `ScheduleChangeRequest '${id}' not found`);
    this.validateDeliveryAllowsScheduleChange(existing!.delivery.status);

    if ("delivery" in (data as any) || "deliveryId" in (data as any)) {
      throw new AppException(
        "delivery relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    if ("requestedBy" in (data as any) || "requestedByUserId" in (data as any)) {
      throw new AppException(
        "requestedBy relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      requestedByRole: this.resolveUpdatedValue(
        data.requestedByRole,
        existing!.requestedByRole
      ),
      status: this.resolveUpdatedValue(data.status, existing!.status),
      reason: this.resolveUpdatedValue(data.reason, existing!.reason),
      decisionNote: this.resolveUpdatedValue(data.decisionNote, existing!.decisionNote),
      proposedPickupWindowStart: this.resolveUpdatedValue(
        data.proposedPickupWindowStart,
        existing!.proposedPickupWindowStart
      ),
      proposedPickupWindowEnd: this.resolveUpdatedValue(
        data.proposedPickupWindowEnd,
        existing!.proposedPickupWindowEnd
      ),
      proposedDropoffWindowStart: this.resolveUpdatedValue(
        data.proposedDropoffWindowStart,
        existing!.proposedDropoffWindowStart
      ),
      proposedDropoffWindowEnd: this.resolveUpdatedValue(
        data.proposedDropoffWindowEnd,
        existing!.proposedDropoffWindowEnd
      ),
      decidedAt: this.resolveUpdatedValue(data.decidedAt, existing!.decidedAt),
    };

    this.ensureStatus(merged.status);
    this.ensureOptionalRequestedByRole(merged.requestedByRole);

    this.validateProposedWindows(
      merged.proposedPickupWindowStart,
      merged.proposedPickupWindowEnd,
      merged.proposedDropoffWindowStart,
      merged.proposedDropoffWindowEnd
    );

    this.validateDecisionFields(
      merged.status,
      merged.decidedAt,
      (data as any).decidedBy,
      (data as any).decidedByUserId,
      merged.decisionNote
    );

    const decidedByUserId = this.resolveRelationId(
      (data as any).decidedBy,
      (data as any).decidedByUserId
    );
    if (decidedByUserId) {
      await this.ensureUserExists(client, decidedByUserId, "decidedBy");
    }

    this.validateStatusTransition(existing!.status, merged.status);
  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "ScheduleChangeRequest id is required for delete");

    const existing = await client.scheduleChangeRequest.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
      },
    });

    this.ensureFound(existing, `ScheduleChangeRequest '${id}' not found`);

    if (existing!.status !== EnumScheduleChangeRequestStatus.PENDING) {
      throw new AppException(
        "Only PENDING schedule change requests can be deleted",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }
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

  private async ensureNoActivePendingRequest(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.scheduleChangeRequest.findFirst({
      where: {
        deliveryId,
        status: EnumScheduleChangeRequestStatus.PENDING,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "A pending schedule change request already exists for this delivery",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateDeliveryAllowsScheduleChange(status: EnumDeliveryRequestStatus): void {
    if (
      status === EnumDeliveryRequestStatus.COMPLETED ||
      status === EnumDeliveryRequestStatus.CANCELLED ||
      status === EnumDeliveryRequestStatus.EXPIRED
    ) {
      throw new AppException(
        "Schedule changes are not allowed in the current delivery status",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateProposedWindows(
    pickupStart: Date | string | null | undefined,
    pickupEnd: Date | string | null | undefined,
    dropoffStart: Date | string | null | undefined,
    dropoffEnd: Date | string | null | undefined
  ): void {
    const hasPickup = !!pickupStart || !!pickupEnd;
    const hasDropoff = !!dropoffStart || !!dropoffEnd;

    if (!hasPickup && !hasDropoff) {
      throw new AppException(
        "At least one proposed schedule window is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    this.validateOptionalDateRange(pickupStart, pickupEnd, "proposed pickup window");
    this.validateOptionalDateRange(dropoffStart, dropoffEnd, "proposed dropoff window");
  }

  private validateOptionalDateRange(
    start: Date | string | null | undefined,
    end: Date | string | null | undefined,
    label: string
  ): void {
    if ((start && !end) || (!start && end)) {
      throw new AppException(
        `${label} start and end must both be provided together`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!start && !end) {
      return;
    }

    const startDate = new Date(start as any);
    const endDate = new Date(end as any);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new AppException(
        `${label} is invalid`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (endDate <= startDate) {
      throw new AppException(
        `${label} end must be after start`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateDecisionFields(
    status: EnumScheduleChangeRequestStatus,
    decidedAt: Date | string | null | undefined,
    decidedBy: any,
    decidedByUserId: string | undefined,
    decisionNote: string | null | undefined
  ): void {
    const resolvedDecidedByUserId = this.resolveRelationId(decidedBy, decidedByUserId);
    const isDecisionStatus =
      status === EnumScheduleChangeRequestStatus.APPROVED ||
      status === EnumScheduleChangeRequestStatus.DECLINED;

    if (isDecisionStatus) {
      if (!decidedAt) {
        throw new AppException(
          "decidedAt is required when status is APPROVED or DECLINED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }

      if (!resolvedDecidedByUserId) {
        throw new AppException(
          "decidedBy is required when status is APPROVED or DECLINED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    } else {
      if (decidedAt || resolvedDecidedByUserId || decisionNote) {
        throw new AppException(
          "Decision fields are only allowed when status is APPROVED or DECLINED",
          ErrorCodes.BUSINESS_RULE_VIOLATION
        );
      }
    }
  }

  private validateRequestedByRoleConsistency(
    role: EnumUserRoles,
    requestedByRole: EnumScheduleChangeRequestRequestedByRole | null | undefined
  ): void {
    if (!requestedByRole) {
      return;
    }

    const map: Record<EnumUserRoles, EnumScheduleChangeRequestRequestedByRole> = {
      PRIVATE_CUSTOMER: EnumScheduleChangeRequestRequestedByRole.PRIVATE_CUSTOMER,
      BUSINESS_CUSTOMER: EnumScheduleChangeRequestRequestedByRole.BUSINESS_CUSTOMER,
      DRIVER: EnumScheduleChangeRequestRequestedByRole.DRIVER,
      ADMIN: EnumScheduleChangeRequestRequestedByRole.ADMIN,
    };

    if (map[role] !== requestedByRole) {
      throw new AppException(
        "requestedByRole does not match the requestedBy user's role",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateStatusTransition(
    fromStatus: EnumScheduleChangeRequestStatus,
    toStatus: EnumScheduleChangeRequestStatus
  ): void {
    if (fromStatus === toStatus) {
      return;
    }

    const allowed: Record<
      EnumScheduleChangeRequestStatus,
      EnumScheduleChangeRequestStatus[]
    > = {
      PENDING: ["APPROVED", "DECLINED", "CANCELLED"],
      APPROVED: [],
      DECLINED: [],
      CANCELLED: [],
    };

    if (!allowed[fromStatus].includes(toStatus)) {
      throw new AppException(
        "ScheduleChangeRequest status transition is invalid",
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

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumScheduleChangeRequestStatus.PENDING &&
      value !== EnumScheduleChangeRequestStatus.APPROVED &&
      value !== EnumScheduleChangeRequestStatus.DECLINED &&
      value !== EnumScheduleChangeRequestStatus.CANCELLED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalRequestedByRole(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumScheduleChangeRequestRequestedByRole.PRIVATE_CUSTOMER &&
      value !== EnumScheduleChangeRequestRequestedByRole.BUSINESS_CUSTOMER &&
      value !== EnumScheduleChangeRequestRequestedByRole.DRIVER &&
      value !== EnumScheduleChangeRequestRequestedByRole.ADMIN
    ) {
      throw new AppException(
        "requestedByRole is invalid",
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
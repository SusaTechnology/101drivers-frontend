// src/domain/deliveryRequest/deliveryRequestPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumCustomerApprovalStatus,
  EnumDeliveryRequestCreatedByRole,
  EnumDeliveryRequestCustomerChose,
  EnumDeliveryRequestServiceType,
  EnumDeliveryRequestStatus,
  EnumUserRoles,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class DeliveryRequestPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.DeliveryRequestCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    const customerId = this.resolveCustomerId(row);
    if (!customerId) {
      throw new AppException(
        "customer is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const customer = await this.ensureCustomerExists(client, customerId);

const status = row.status ?? EnumDeliveryRequestStatus.DRAFT;
const isDraft = status === EnumDeliveryRequestStatus.DRAFT;

if (!isDraft) {
  this.ensureRequiredString(row.pickupAddress, "pickupAddress is required");
  this.ensureRequiredString(row.dropoffAddress, "dropoffAddress is required");
  this.ensureRequiredString(row.licensePlate, "licensePlate is required");
  this.ensureRequiredString(row.vehicleColor, "vehicleColor is required");
  this.ensureRequiredString(
    row.vinVerificationCode,
    "vinVerificationCode is required"
  );
} else {
  this.ensureOptionalString(row.pickupAddress, "pickupAddress");
  this.ensureOptionalString(row.dropoffAddress, "dropoffAddress");
  this.ensureOptionalString(row.licensePlate, "licensePlate");
  this.ensureOptionalString(row.vehicleColor, "vehicleColor");
  this.ensureOptionalString(row.vinVerificationCode, "vinVerificationCode");
}

this.validateLatLngPair(row.pickupLat, row.pickupLng, "pickup");
this.validateLatLngPair(row.dropoffLat, row.dropoffLng, "dropoff");

if (row.pickupState !== undefined && row.pickupState !== null && row.pickupState !== "") {
  this.validateCaliforniaState(row.pickupState, "pickupState");
}
if (row.dropoffState !== undefined && row.dropoffState !== null && row.dropoffState !== "") {
  this.validateCaliforniaState(row.dropoffState, "dropoffState");
}

    this.validateOptionalDateRange(
      row.pickupWindowStart,
      row.pickupWindowEnd,
      "pickup window"
    );
    this.validateOptionalDateRange(
      row.dropoffWindowStart,
      row.dropoffWindowEnd,
      "dropoff window"
    );

    this.ensureOptionalNonNegativeInteger(
      row.etaMinutes,
      "etaMinutes must be a non-negative integer"
    );
    this.ensureOptionalNonNegativeInteger(
      row.bufferMinutes,
      "bufferMinutes must be a non-negative integer"
    );
    this.ensureOptionalNonNegativeNumber(
      row.urgentBonusAmount,
      "urgentBonusAmount must be a non-negative number"
    );

    this.validateTrackingShareExpiry(
      row.trackingShareToken,
      row.trackingShareExpiresAt
    );

    if (
      row.requiresOpsConfirmation === true &&
      row.afterHours !== true &&
      row.sameDayEligible !== false
    ) {
      // allowed, no-op
    }

    if (row.createdByRole && !row.createdBy && !row.createdByUserId) {
      throw new AppException(
        "createdBy is required when createdByRole is provided",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    const createdByUserId = this.resolveUserId(row.createdBy, row.createdByUserId);
    if (createdByUserId) {
      const createdBy = await this.ensureUserExists(client, createdByUserId, "createdBy");
      this.validateCreatedByRoleConsistency(createdBy.roles, row.createdByRole);
    }

    const quoteId = this.resolveQuoteId(row);
    if (quoteId) {
      const quote = await this.ensureQuoteAvailable(client, quoteId);
      this.validateQuoteCompatibility(row, quote, customer.id);
    }

    const resubmittedFromId = this.resolveResubmittedFromId(row);
    if (resubmittedFromId) {
      await this.ensureResubmittedFromExists(client, resubmittedFromId);
    }

    this.validateCustomerApproval(customer.approvalStatus);
  }

async beforeUpdate(
  client: PrismaClient,
  id: string | undefined,
  data: Prisma.DeliveryRequestUpdateArgs["data"]
): Promise<void> {
  this.ensureId(id, "DeliveryRequest id is required for update");

  const existing = await client.deliveryRequest.findUnique({
    where: { id: id! },
    select: {
      id: true,
      status: true,
      serviceType: true,
      customerId: true,
      quoteId: true,
      createdByUserId: true,
      createdByRole: true,
      customerChose: true,

      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      pickupPlaceId: true,
      pickupState: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,

      dropoffAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffPlaceId: true,
      dropoffState: true,
      dropoffWindowStart: true,
      dropoffWindowEnd: true,

      licensePlate: true,
      vehicleColor: true,
      vehicleMake: true,
      vehicleModel: true,
      vinVerificationCode: true,

      recipientName: true,
      recipientEmail: true,
      recipientPhone: true,

      etaMinutes: true,
      bufferMinutes: true,
      sameDayEligible: true,
      requiresOpsConfirmation: true,
      afterHours: true,
      isUrgent: true,
      urgentBonusAmount: true,

      trackingShareToken: true,
      trackingShareExpiresAt: true,
      resubmittedFromId: true,
    },
  });

  this.ensureFound(existing, `DeliveryRequest '${id}' not found`);

  const nextCustomerId = this.resolveIncomingRelationId(
    (data as any).customer,
    (data as any).customerId,
    existing!.customerId
  );

  if (nextCustomerId !== existing!.customerId) {
    throw new AppException(
      "customer relation cannot be changed",
      ErrorCodes.INVALID_OPERATION
    );
  }

  const nextCreatedByUserId = this.resolveIncomingRelationId(
    (data as any).createdBy,
    (data as any).createdByUserId,
    existing!.createdByUserId
  );

  if (nextCreatedByUserId !== existing!.createdByUserId) {
    throw new AppException(
      "createdBy relation cannot be changed",
      ErrorCodes.INVALID_OPERATION
    );
  }

  // ...keep the rest of your merged validation logic unchanged
}

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "DeliveryRequest id is required for delete");

    const existing = await client.deliveryRequest.findUnique({
      where: { id: id! },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            assignments: true,
            audits: true,
            evidence: true,
            evidenceExports: true,
            notifications: true,
            resubmissions: true,
            scheduleChanges: true,
            statusHistory: true,
          },
        },
        compliance: { select: { id: true } },
        dispute: { select: { id: true } },
        payment: { select: { id: true } },
        payout: { select: { id: true } },
        rating: { select: { id: true } },
        tip: { select: { id: true } },
        trackingSession: { select: { id: true } },
      },
    });

    this.ensureFound(existing, `DeliveryRequest '${id}' not found`);

    if (
      existing!.status !== EnumDeliveryRequestStatus.DRAFT &&
      existing!.status !== EnumDeliveryRequestStatus.QUOTED
    ) {
      throw new AppException(
        "Only DRAFT or QUOTED delivery requests can be deleted",
        ErrorCodes.BUSINESS_RULE_VIOLATION,
        HttpStatus.CONFLICT
      );
    }

    if (
      existing!._count.assignments > 0 ||
      existing!._count.audits > 0 ||
      existing!._count.evidence > 0 ||
      existing!._count.evidenceExports > 0 ||
      existing!._count.notifications > 0 ||
      existing!._count.resubmissions > 0 ||
      existing!._count.scheduleChanges > 0 ||
      existing!._count.statusHistory > 0 ||
      !!existing!.compliance?.id ||
      !!existing!.dispute?.id ||
      !!existing!.payment?.id ||
      !!existing!.payout?.id ||
      !!existing!.rating?.id ||
      !!existing!.tip?.id ||
      !!existing!.trackingSession?.id
    ) {
      throw new AppException(
        "DeliveryRequest cannot be deleted because related records exist",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureCustomerExists(client: PrismaClient, customerId: string) {
    const row = await client.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        approvalStatus: true,
      },
    });

    if (!row) {
      throw new AppException(
        `Customer '${customerId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    return row;
  }

  private validateCustomerApproval(approvalStatus: EnumCustomerApprovalStatus): void {
    if (approvalStatus !== EnumCustomerApprovalStatus.APPROVED) {
      throw new AppException(
        "Customer must be APPROVED before creating a delivery request",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
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

  private validateCreatedByRoleConsistency(
    role: EnumUserRoles,
    createdByRole: EnumDeliveryRequestCreatedByRole | null | undefined
  ): void {
    if (!createdByRole) {
      return;
    }

    const map: Record<EnumUserRoles, EnumDeliveryRequestCreatedByRole> = {
      PRIVATE_CUSTOMER: EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER,
      BUSINESS_CUSTOMER: EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER,
      DRIVER: EnumDeliveryRequestCreatedByRole.DRIVER,
      ADMIN: EnumDeliveryRequestCreatedByRole.ADMIN,
    };

    if (map[role] !== createdByRole) {
      throw new AppException(
        "createdByRole does not match the createdBy user's role",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private async ensureQuoteAvailable(
    client: PrismaClient,
    quoteId: string,
    excludeDeliveryId?: string
  ) {
    const row = await client.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        serviceType: true,
        pickupAddress: true,
        pickupLat: true,
        pickupLng: true,
        pickupPlaceId: true,
        pickupState: true,
        dropoffAddress: true,
        dropoffLat: true,
        dropoffLng: true,
        dropoffPlaceId: true,
        dropoffState: true,
        delivery: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!row) {
      throw new AppException(
        `Quote '${quoteId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (row.delivery?.id && row.delivery.id !== excludeDeliveryId) {
      throw new AppException(
        "Quote is already linked to another delivery request",
        ErrorCodes.CONFLICT,
        HttpStatus.CONFLICT
      );
    }

    return row;
  }

  private validateQuoteCompatibility(
    row: any,
    quote: any,
    customerId: string
  ): void {
    if (row.serviceType !== quote.serviceType) {
      throw new AppException(
        "DeliveryRequest serviceType must match Quote serviceType",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.pickupAddress !== quote.pickupAddress) {
      throw new AppException(
        "pickupAddress must match the selected quote",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (row.dropoffAddress !== quote.dropoffAddress) {
      throw new AppException(
        "dropoffAddress must match the selected quote",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private async ensureResubmittedFromExists(
    client: PrismaClient,
    deliveryId: string,
    excludeId?: string
  ): Promise<void> {
    if (excludeId && deliveryId === excludeId) {
      throw new AppException(
        "DeliveryRequest cannot resubmit from itself",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const row = await client.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `resubmittedFrom '${deliveryId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  private ensureStatus(value: unknown): void {
    if (
      value !== EnumDeliveryRequestStatus.DRAFT &&
      value !== EnumDeliveryRequestStatus.QUOTED &&
      value !== EnumDeliveryRequestStatus.LISTED &&
      value !== EnumDeliveryRequestStatus.BOOKED &&
      value !== EnumDeliveryRequestStatus.ACTIVE &&
      value !== EnumDeliveryRequestStatus.COMPLETED &&
      value !== EnumDeliveryRequestStatus.CANCELLED &&
      value !== EnumDeliveryRequestStatus.EXPIRED &&
      value !== EnumDeliveryRequestStatus.DISPUTED
    ) {
      throw new AppException(
        "status is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureServiceType(value: unknown): void {
    if (
      value !== EnumDeliveryRequestServiceType.HOME_DELIVERY &&
      value !== EnumDeliveryRequestServiceType.BETWEEN_LOCATIONS &&
      value !== EnumDeliveryRequestServiceType.SERVICE_PICKUP_RETURN
    ) {
      throw new AppException(
        "serviceType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalCreatedByRole(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumDeliveryRequestCreatedByRole.PRIVATE_CUSTOMER &&
      value !== EnumDeliveryRequestCreatedByRole.BUSINESS_CUSTOMER &&
      value !== EnumDeliveryRequestCreatedByRole.DRIVER &&
      value !== EnumDeliveryRequestCreatedByRole.ADMIN
    ) {
      throw new AppException(
        "createdByRole is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureOptionalCustomerChose(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }

    if (
      value !== EnumDeliveryRequestCustomerChose.PICKUP_WINDOW &&
      value !== EnumDeliveryRequestCustomerChose.DROPOFF_WINDOW
    ) {
      throw new AppException(
        "customerChose is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private validateLatLngPair(
    lat: unknown,
    lng: unknown,
    prefix: "pickup" | "dropoff"
  ): void {
    const hasLat = lat !== undefined && lat !== null;
    const hasLng = lng !== undefined && lng !== null;

    if (hasLat !== hasLng) {
      throw new AppException(
        `${prefix}Lat and ${prefix}Lng must both be provided together`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!hasLat && !hasLng) {
      return;
    }

    const latNum =
      typeof lat === "number" ? lat : typeof lat === "string" ? Number(lat) : NaN;
    const lngNum =
      typeof lng === "number" ? lng : typeof lng === "string" ? Number(lng) : NaN;

    if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      throw new AppException(
        `${prefix}Lat must be a valid latitude`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new AppException(
        `${prefix}Lng must be a valid longitude`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private validateCaliforniaState(value: unknown, field: string): void {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (typeof value !== "string") {
      throw new AppException(
        `${field} must be a valid state value`,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const normalized = value.trim().toUpperCase();
    if (normalized !== "CA" && normalized !== "CALIFORNIA") {
      throw new AppException(
        `${field} must be CA for the California MVP`,
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateOptionalDateRange(
    start: unknown,
    end: unknown,
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

  private ensureOptionalNonNegativeInteger(value: unknown, message: string): void {
    if (value === undefined || value === null) {
      return;
    }

    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
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
  private ensureOptionalNonNegativeNumber(value: unknown, message: string): void {
    if (value === undefined || value === null) {
      return;
    }

    const num =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;

    if (!Number.isFinite(num) || num < 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
    }
  }

  private validateTrackingShareExpiry(
    token: string | null | undefined,
    expiresAt: Date | string | null | undefined
  ): void {
    if ((token && !expiresAt) || (!token && expiresAt)) {
      throw new AppException(
        "trackingShareToken and trackingShareExpiresAt must be provided together",
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!token && !expiresAt) {
      return;
    }

    const date = new Date(expiresAt as any);
    if (Number.isNaN(date.getTime())) {
      throw new AppException(
        "trackingShareExpiresAt is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private resolveCustomerId(row: any): string | undefined {
    if (typeof row?.customerId === "string" && row.customerId.trim().length > 0) {
      return row.customerId.trim();
    }

    if (row?.customer?.connect?.id) {
      return row.customer.connect.id;
    }

    return undefined;
  }

  private resolveUserId(relation: any, scalar: any): string | undefined {
    if (typeof scalar === "string" && scalar.trim().length > 0) {
      return scalar.trim();
    }

    if (relation?.connect?.id) {
      return relation.connect.id;
    }

    return undefined;
  }

  private resolveQuoteId(row: any): string | undefined {
    if (typeof row?.quoteId === "string" && row.quoteId.trim().length > 0) {
      return row.quoteId.trim();
    }

    if (row?.quote?.connect?.id) {
      return row.quote.connect.id;
    }

    return undefined;
  }

  private resolveResubmittedFromId(row: any): string | undefined {
    if (
      typeof row?.resubmittedFromId === "string" &&
      row.resubmittedFromId.trim().length > 0
    ) {
      return row.resubmittedFromId.trim();
    }

    if (row?.resubmittedFrom?.connect?.id) {
      return row.resubmittedFrom.connect.id;
    }

    return undefined;
  }

  private resolveRelationConnectId(value: any): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return value.connect?.id;
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
private resolveIncomingRelationId(
  relation: any,
  scalar: any,
  currentValue: string | null | undefined
): string | null | undefined {
  if (scalar !== undefined) {
    if (scalar === null) {
      return null;
    }

    if (typeof scalar === "string") {
      const trimmed = scalar.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return scalar;
  }

  if (relation !== undefined) {
    if (relation === null) {
      return null;
    }

    if (typeof relation === "object") {
      if ("connect" in relation) {
        return relation.connect?.id ?? null;
      }

      if ("disconnect" in relation && relation.disconnect === true) {
        return null;
      }

      if ("set" in relation) {
        return relation.set ?? null;
      }
    }
  }

  return currentValue;
}
}
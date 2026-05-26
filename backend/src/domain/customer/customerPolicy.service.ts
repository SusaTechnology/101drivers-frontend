// src/domain/customer/customerPolicy.service.ts

import { HttpStatus, Injectable } from "@nestjs/common";
import {
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { AppException } from "../../errors/app.exception";
import { ErrorCodes } from "../../errors/error-codes";

@Injectable()
export class CustomerPolicyService {
  async beforeCreate(
    client: PrismaClient,
    data: Prisma.CustomerCreateArgs["data"]
  ): Promise<void> {
    const row = data as any;

    this.ensureUserProvided(row);
    this.ensureCustomerType(row.customerType);

    if (row.customerType === EnumCustomerCustomerType.BUSINESS) {
      this.validateBusinessCustomer(row);
    }

    if (
      row.postpaidEnabled === true &&
      row.customerType !== EnumCustomerCustomerType.BUSINESS
    ) {
      throw new AppException(
        "postpaidEnabled is only allowed for BUSINESS customers",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    this.validateApprovalFields(row.approvalStatus, row.approvedAt, row.approvedBy);

    const businessPlaceId = this.resolveCreateString(row.businessPlaceId);
    if (businessPlaceId) {
      await this.ensureBusinessPlaceIdUnique(client, businessPlaceId);
    }

    const pricingConfigId = this.resolveConnectedId(row.pricingConfig);
    if (pricingConfigId) {
      await this.ensurePricingConfigExists(client, pricingConfigId);
    }

    if (row.defaultPickup?.connect?.id) {
      throw new AppException(
        "defaultPickup cannot be connected during customer create",
        ErrorCodes.INVALID_OPERATION
      );
    }
    if (
  row.postpaidEnabled === true &&
  row.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
) {
  throw new AppException(
    "postpaidEnabled is only allowed for APPROVED BUSINESS customers",
    ErrorCodes.BUSINESS_RULE_VIOLATION
  );
}

  }

  async beforeUpdate(
    client: PrismaClient,
    id: string | undefined,
    data: Prisma.CustomerUpdateArgs["data"]
  ): Promise<void> {
    this.ensureId(id, "Customer id is required for update");

    const existing = await client.customer.findUnique({
      where: { id: id! },
      select: {
        id: true,
        userId: true,
        customerType: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        businessName: true,
        businessAddress: true,
        businessPhone: true,
        businessPlaceId: true,
        businessWebsite: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        phone: true,
        postpaidEnabled: true,
        pricingConfigId: true,
        pricingModeOverride: true,
        defaultPickupId: true,
        suspendedAt: true,
        suspensionReason: true,
      },
    });

    this.ensureFound(existing, `Customer '${id}' not found`);

    if ("user" in (data as any) || "userId" in (data as any)) {
      throw new AppException(
        "user relation cannot be changed",
        ErrorCodes.INVALID_OPERATION
      );
    }

    const merged = {
      customerType: this.resolveUpdatedValue(data.customerType, existing!.customerType),
      approvalStatus: this.resolveUpdatedValue(
        data.approvalStatus,
        existing!.approvalStatus
      ),
      approvedAt: this.resolveUpdatedValue(data.approvedAt, existing!.approvedAt),

      businessName: this.resolveUpdatedValue(data.businessName, existing!.businessName),
      businessAddress: this.resolveUpdatedValue(
        data.businessAddress,
        existing!.businessAddress
      ),
      businessPhone: this.resolveUpdatedValue(data.businessPhone, existing!.businessPhone),
      businessPlaceId: this.resolveUpdatedValue(
        data.businessPlaceId,
        existing!.businessPlaceId
      ),
      businessWebsite: this.resolveUpdatedValue(
        data.businessWebsite,
        existing!.businessWebsite
      ),

      contactName: this.resolveUpdatedValue(data.contactName, existing!.contactName),
      contactEmail: this.resolveUpdatedValue(data.contactEmail, existing!.contactEmail),
      contactPhone: this.resolveUpdatedValue(data.contactPhone, existing!.contactPhone),

      phone: this.resolveUpdatedValue(data.phone, existing!.phone),
      postpaidEnabled: this.resolveUpdatedValue(
        data.postpaidEnabled,
        existing!.postpaidEnabled
      ),
      pricingModeOverride: this.resolveUpdatedValue(
        data.pricingModeOverride,
        existing!.pricingModeOverride
      ),
      suspendedAt: this.resolveUpdatedValue(data.suspendedAt, existing!.suspendedAt),
      suspensionReason: this.resolveUpdatedValue(
        data.suspensionReason,
        existing!.suspensionReason
      ),
    };

    this.ensureCustomerType(merged.customerType);

    if (merged.customerType === EnumCustomerCustomerType.BUSINESS) {
      this.validateBusinessCustomer(merged);
    }

    if (
      merged.postpaidEnabled === true &&
      merged.customerType !== EnumCustomerCustomerType.BUSINESS
    ) {
      throw new AppException(
        "postpaidEnabled is only allowed for BUSINESS customers",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    this.validateApprovalFields(
      merged.approvalStatus,
      merged.approvedAt,
      (data as any).approvedBy
    );

    this.validateSuspensionFields(merged.suspendedAt, merged.suspensionReason);

    const nextBusinessPlaceId = this.resolveScalarUpdateValue(data.businessPlaceId);
    if (nextBusinessPlaceId && nextBusinessPlaceId !== existing!.businessPlaceId) {
      await this.ensureBusinessPlaceIdUnique(client, nextBusinessPlaceId, id!);
    }

    const nextDefaultPickupId = this.resolveConnectedId((data as any).defaultPickup);
    if (nextDefaultPickupId) {
      await this.ensureSavedAddressBelongsToCustomer(client, nextDefaultPickupId, id!);
    }

    const nextPricingConfigId = this.resolveConnectedId((data as any).pricingConfig);
    if (nextPricingConfigId) {
      await this.ensurePricingConfigExists(client, nextPricingConfigId);
    }

    const nextApprovedById = this.resolveConnectedId((data as any).approvedBy);
    if (
      nextApprovedById &&
      merged.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
    ) {
      throw new AppException(
        "approvedBy is only allowed when approvalStatus is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (
  merged.postpaidEnabled === true &&
  merged.approvalStatus !== EnumCustomerApprovalStatus.APPROVED
) {
  throw new AppException(
    "postpaidEnabled is only allowed for APPROVED BUSINESS customers",
    ErrorCodes.BUSINESS_RULE_VIOLATION
  );
}

  }

  async beforeDelete(
    client: PrismaClient,
    id: string | undefined
  ): Promise<void> {
    this.ensureId(id, "Customer id is required for delete");

    const existing = await client.customer.findUnique({
      where: { id: id! },
      select: {
        id: true,
        _count: {
          select: {
            addresses: true,
            audits: true,
            deliveries: true,
            notifications: true,
            ratings: true,
            vehicles: true,
          },
        },
      },
    });

    this.ensureFound(existing, `Customer '${id}' not found`);

    if (
      existing!._count.addresses > 0 ||
      existing!._count.audits > 0 ||
      existing!._count.deliveries > 0 ||
      existing!._count.notifications > 0 ||
      existing!._count.ratings > 0 ||
      existing!._count.vehicles > 0
    ) {
      throw new AppException(
        "Customer cannot be deleted because related records exist",
        ErrorCodes.STILL_IN_USE,
        HttpStatus.CONFLICT
      );
    }
  }

  private validateBusinessCustomer(data: any): void {
    this.ensureRequiredString(data.businessPlaceId, "businessPlaceId is required");
    this.ensureRequiredString(data.businessName, "businessName is required");
    this.ensureRequiredString(data.businessAddress, "businessAddress is required");
    this.ensureRequiredString(data.businessPhone, "businessPhone is required");
    this.ensureRequiredString(data.contactName, "contactName is required");
    this.ensureRequiredString(data.contactEmail, "contactEmail is required");
    this.ensureRequiredString(data.contactPhone, "contactPhone is required");
  }

  private validateApprovalFields(
    approvalStatus: EnumCustomerApprovalStatus | undefined,
    approvedAt: Date | string | null | undefined,
    approvedBy: any
  ): void {
    const approvedById = this.resolveConnectedId(approvedBy);

    if (approvedAt && approvalStatus !== EnumCustomerApprovalStatus.APPROVED) {
      throw new AppException(
        "approvedAt is only allowed when approvalStatus is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }

    if (approvedById && approvalStatus !== EnumCustomerApprovalStatus.APPROVED) {
      throw new AppException(
        "approvedBy is only allowed when approvalStatus is APPROVED",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private validateSuspensionFields(
    suspendedAt: Date | string | null | undefined,
    suspensionReason: string | null | undefined
  ): void {
    if (suspendedAt && !suspensionReason) {
      throw new AppException(
        "suspensionReason is required when suspendedAt is set",
        ErrorCodes.BUSINESS_RULE_VIOLATION
      );
    }
  }

  private async ensureBusinessPlaceIdUnique(
    client: PrismaClient,
    businessPlaceId: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await client.customer.findFirst({
      where: {
        businessPlaceId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppException(
        "businessPlaceId already exists",
        ErrorCodes.DUPLICATE_ENTRY,
        HttpStatus.CONFLICT
      );
    }
  }

  private async ensureSavedAddressBelongsToCustomer(
    client: PrismaClient,
    savedAddressId: string,
    customerId: string
  ): Promise<void> {
    const row = await client.savedAddress.findFirst({
      where: {
        id: savedAddressId,
        customerId,
      },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        "defaultPickup must belong to the same customer",
        ErrorCodes.RELATION_CONFLICT
      );
    }
  }

  private async ensurePricingConfigExists(
    client: PrismaClient,
    pricingConfigId: string
  ): Promise<void> {
    const row = await client.pricingConfig.findUnique({
      where: { id: pricingConfigId },
      select: { id: true },
    });

    if (!row) {
      throw new AppException(
        `PricingConfig '${pricingConfigId}' not found`,
        ErrorCodes.NOT_FOUND,
        HttpStatus.NOT_FOUND
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

  private ensureCustomerType(value: unknown): void {
    if (
      value !== EnumCustomerCustomerType.BUSINESS &&
      value !== EnumCustomerCustomerType.PRIVATE
    ) {
      throw new AppException(
        "customerType is invalid",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureUserProvided(row: any): void {
    const hasCheckedRelation = !!row?.user;
    const hasUncheckedUserId =
      typeof row?.userId === "string" && row.userId.trim().length > 0;

    if (!hasCheckedRelation && !hasUncheckedUserId) {
      throw new AppException(
        "user is required",
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  private ensureRequiredString(value: unknown, message: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppException(message, ErrorCodes.VALIDATION_ERROR);
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

  private resolveConnectedId(value: any): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return value.connect?.id;
  }

  private resolveScalarUpdateValue(value: any): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object" && "set" in value) {
      return value.set ?? undefined;
    }

    return undefined;
  }

  private resolveCreateString(value: any): string | undefined {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
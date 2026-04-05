// src/customer/customer.service.ts

import { Injectable } from "@nestjs/common";
import {
  AdminAuditLog as PrismaAdminAuditLog,
  Customer as PrismaCustomer,
  DeliveryRating as PrismaDeliveryRating,
  DeliveryRequest as PrismaDeliveryRequest,
  NotificationEvent as PrismaNotificationEvent,
  PricingConfig as PrismaPricingConfig,
  Prisma,
  SavedAddress as PrismaSavedAddress,
  SavedVehicle as PrismaSavedVehicle,
  User as PrismaUser,
  EnumCustomerCustomerType,
  EnumCustomerApprovalStatus,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CustomerServiceBase } from "./base/customer.service.base";
import { CustomerDomain } from "../domain/customer/customer.domain";
import { CustomerPolicyService } from "../domain/customer/customerPolicy.service";
import { CustomerApprovalEngine } from "src/domain/customer/customerApproval.engine";
import { CustomerPricingEngine } from "../domain/customer/customerPricing.engine";
import { stripEmptyObjectsDeep } from "../domain/common/policy/utils/stripEmptyObjectsDeep.util";

@Injectable()
export class CustomerService extends CustomerServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: CustomerDomain,
    private readonly policy: CustomerPolicyService,
    private readonly customerApprovalEngine: CustomerApprovalEngine,
    private readonly customerPricingEngine: CustomerPricingEngine
  ) {
    super(prisma);
  }

  async count(
    args: Omit<Prisma.CustomerCountArgs, "select"> = {}
  ): Promise<number> {
    return this.prisma.customer.count(args);
  }

  async customers(args: Prisma.CustomerFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async customer(args: Prisma.CustomerFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createCustomer(args: Prisma.CustomerCreateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeCreateData(args.data)
    ) as Prisma.CustomerCreateArgs["data"];

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.customer.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateCustomer(args: Prisma.CustomerUpdateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeUpdateData(args.data)
    ) as Prisma.CustomerUpdateArgs["data"];

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.customer.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteCustomer(
    args: Prisma.CustomerDeleteArgs
  ): Promise<PrismaCustomer> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.customer.delete(args);
  }

  async findAddresses(
    parentId: string,
    args: Prisma.SavedAddressFindManyArgs
  ): Promise<PrismaSavedAddress[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .addresses(args);
  }

  async findAudits(
    parentId: string,
    args: Prisma.AdminAuditLogFindManyArgs
  ): Promise<PrismaAdminAuditLog[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .audits(args);
  }

  async findDeliveries(
    parentId: string,
    args: Prisma.DeliveryRequestFindManyArgs
  ): Promise<PrismaDeliveryRequest[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .deliveries(args);
  }

  async findNotifications(
    parentId: string,
    args: Prisma.NotificationEventFindManyArgs
  ): Promise<PrismaNotificationEvent[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .notifications(args);
  }

  async findRatings(
    parentId: string,
    args: Prisma.DeliveryRatingFindManyArgs
  ): Promise<PrismaDeliveryRating[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .ratings(args);
  }

  async findVehicles(
    parentId: string,
    args: Prisma.SavedVehicleFindManyArgs
  ): Promise<PrismaSavedVehicle[]> {
    return this.prisma.customer
      .findUniqueOrThrow({ where: { id: parentId } })
      .vehicles(args);
  }

  async getApprovedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.customer
      .findUnique({ where: { id: parentId } })
      .approvedBy();
  }

  async getDefaultPickup(
    parentId: string
  ): Promise<PrismaSavedAddress | null> {
    return this.prisma.customer
      .findUnique({ where: { id: parentId } })
      .defaultPickup();
  }

  async getPricingConfig(
    parentId: string
  ): Promise<PrismaPricingConfig | null> {
    return this.prisma.customer
      .findUnique({ where: { id: parentId } })
      .pricingConfig();
  }

  async getUser(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.customer.findUnique({ where: { id: parentId } }).user();
  }

  private normalizeCreateData(
    data: Prisma.CustomerCreateArgs["data"]
  ): Prisma.CustomerCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.businessName = this.trimOptionalString(normalized.businessName);
    normalized.businessAddress = this.trimOptionalString(
      normalized.businessAddress
    );
    normalized.businessPhone = this.trimOptionalString(normalized.businessPhone);
    normalized.businessPlaceId = this.trimOptionalString(
      normalized.businessPlaceId
    );
    normalized.businessWebsite = this.trimOptionalString(
      normalized.businessWebsite
    );

    normalized.contactName = this.trimOptionalString(normalized.contactName);
    normalized.contactEmail = this.trimOptionalString(normalized.contactEmail);
    normalized.contactPhone = this.trimOptionalString(normalized.contactPhone);

    normalized.phone = this.trimOptionalString(normalized.phone);
    normalized.suspensionReason = this.trimOptionalString(
      normalized.suspensionReason
    );

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.CustomerUpdateArgs["data"]
  ): Prisma.CustomerUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "businessName");
    this.normalizeUpdateStringField(normalized, "businessAddress");
    this.normalizeUpdateStringField(normalized, "businessPhone");
    this.normalizeUpdateStringField(normalized, "businessPlaceId");
    this.normalizeUpdateStringField(normalized, "businessWebsite");

    this.normalizeUpdateStringField(normalized, "contactName");
    this.normalizeUpdateStringField(normalized, "contactEmail");
    this.normalizeUpdateStringField(normalized, "contactPhone");

    this.normalizeUpdateStringField(normalized, "phone");
    this.normalizeUpdateStringField(normalized, "suspensionReason");

    return normalized;
  }

  private trimOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value as any;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeUpdateStringField(
    target: Record<string, any>,
    field: string
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: this.trimOptionalString(raw.set),
      };
      return;
    }

    target[field] = this.trimOptionalString(raw);
  }

  async getPendingApprovalCustomers(): Promise<any[]> {
    return this.domain.findMany({
      where: {
        customerType: EnumCustomerCustomerType.BUSINESS,
        approvalStatus: EnumCustomerApprovalStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approveCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    postpaidEnabled?: boolean;
    note?: string | null;
  }): Promise<any> {
    await this.customerApprovalEngine.approveCustomer({
      customerId: input.customerId,
      actorUserId: input.actorUserId ?? null,
      postpaidEnabled: input.postpaidEnabled === true,
      note: input.note ?? null,
    });

    return this.domain.findUnique({ id: input.customerId });
  }

  async rejectCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    reason?: string | null;
  }): Promise<any> {
    await this.customerApprovalEngine.rejectCustomer({
      customerId: input.customerId,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? null,
    });

    return this.domain.findUnique({ id: input.customerId });
  }

  async suspendCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    reason: string;
  }): Promise<any> {
    await this.customerApprovalEngine.suspendCustomer({
      customerId: input.customerId,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason,
    });

    return this.domain.findUnique({ id: input.customerId });
  }

  async unsuspendCustomer(input: {
    customerId: string;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<any> {
    await this.customerApprovalEngine.unsuspendCustomer({
      customerId: input.customerId,
      actorUserId: input.actorUserId ?? null,
      note: input.note ?? null,
    });

    return this.domain.findUnique({ id: input.customerId });
  }

  async adminAssignPricing(input: {
    customerId: string;
    pricingConfigId?: string | null;
    pricingModeOverride?: any;
    postpaidEnabled?: boolean | null;
    actorUserId?: string | null;
    note?: string | null;
  }): Promise<any> {
    await this.customerPricingEngine.assignPricing({
      customerId: input.customerId,
      pricingConfigId: input.pricingConfigId ?? undefined,
      pricingModeOverride: input.pricingModeOverride ?? undefined,
      postpaidEnabled: input.postpaidEnabled ?? undefined,
      actorUserId: input.actorUserId ?? null,
      note: input.note ?? null,
    });

    return this.domain.findUnique({ id: input.customerId });
  }
    async customerLookupList(): Promise<
    { id: string; name: string | null; customerType: EnumCustomerCustomerType }[]
  > {
    const rows = await this.prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        customerType: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name:
        row.customerType === EnumCustomerCustomerType.BUSINESS
          ? row.businessName ?? row.contactName ?? null
          : row.contactName ?? row.businessName ?? null,
      customerType: row.customerType,
    }));
  }
}
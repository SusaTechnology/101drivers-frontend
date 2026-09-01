import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AdminAuditLog as PrismaAdminAuditLog,
  Customer as PrismaCustomer,
  DeliveryAssignment as PrismaDeliveryAssignment,
  DeliveryCompliance as PrismaDeliveryCompliance,
  DeliveryRequest as PrismaDeliveryRequest,
  DeliveryStatusHistory as PrismaDeliveryStatusHistory,
  DisputeNote as PrismaDisputeNote,
  Driver as PrismaDriver,
  EvidenceExport as PrismaEvidenceExport,
  NotificationEvent as PrismaNotificationEvent,
  Prisma,
  ScheduleChangeRequest as PrismaScheduleChangeRequest,
  User as PrismaUser,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { UserServiceBase } from "./base/user.service.base";
import { UserDomain } from "../domain/user/user.domain";
import { UserPolicyService } from "../domain/user/userPolicy.service";
import { stripEmptyObjectsDeep } from "../domain/common/policy/utils/stripEmptyObjectsDeep.util";
import {
  EnumAdminAuditLogAction,
  EnumAdminAuditLogActorType,
  EnumCustomerApprovalStatus,
  EnumCustomerCustomerType,
  EnumDriverStatus,
  EnumUserRoles,
} from "@prisma/client";
import { CustomerService } from "src/customer/customer.service";
import { DriverService } from "src/driver/driver.service";
import { PasswordService } from "src/auth/password.service";
@Injectable()
export class UserService extends UserServiceBase {
constructor(
  protected readonly prisma: PrismaService,
  private readonly domain: UserDomain,
  private readonly policy: UserPolicyService,
  private readonly customerService: CustomerService,
  private readonly driverService: DriverService,
  private readonly passwordService: PasswordService
) {
  super(prisma);
}

  async count(args: Omit<Prisma.UserCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.user.count(args);
  }

  async users(args: Prisma.UserFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async user(args: Prisma.UserFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createUser(args: Prisma.UserCreateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeCreateData(args.data)
    ) as Prisma.UserCreateArgs["data"];

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.user.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateUser(args: Prisma.UserUpdateArgs): Promise<any> {
    const normalizedData = stripEmptyObjectsDeep(
      this.normalizeUpdateData(args.data)
    ) as Prisma.UserUpdateArgs["data"];

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.user.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteUser(args: Prisma.UserDeleteArgs): Promise<PrismaUser> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.user.delete(args);
  }

  async findAdminActions(
    parentId: string,
    args: Prisma.AdminAuditLogFindManyArgs
  ): Promise<PrismaAdminAuditLog[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .adminActions(args);
  }

  async findAssignmentsMade(
    parentId: string,
    args: Prisma.DeliveryAssignmentFindManyArgs
  ): Promise<PrismaDeliveryAssignment[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .assignmentsMade(args);
  }

  async findAuditTargets(
    parentId: string,
    args: Prisma.AdminAuditLogFindManyArgs
  ): Promise<PrismaAdminAuditLog[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .auditTargets(args);
  }

  async findCompliancesVerified(
    parentId: string,
    args: Prisma.DeliveryComplianceFindManyArgs
  ): Promise<PrismaDeliveryCompliance[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .compliancesVerified(args);
  }

  async findCustomersApproved(
    parentId: string,
    args: Prisma.CustomerFindManyArgs
  ): Promise<PrismaCustomer[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .customersApproved(args);
  }

  async findDeliveriesCreated(
    parentId: string,
    args: Prisma.DeliveryRequestFindManyArgs
  ): Promise<PrismaDeliveryRequest[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .deliveriesCreated(args);
  }

  async findDisputeNotesAuthored(
    parentId: string,
    args: Prisma.DisputeNoteFindManyArgs
  ): Promise<PrismaDisputeNote[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .disputeNotesAuthored(args);
  }

  async findDriversApproved(
    parentId: string,
    args: Prisma.DriverFindManyArgs
  ): Promise<PrismaDriver[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .driversApproved(args);
  }

  async findExportsCreated(
    parentId: string,
    args: Prisma.EvidenceExportFindManyArgs
  ): Promise<PrismaEvidenceExport[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .exportsCreated(args);
  }

  async findNotifEvents(
    parentId: string,
    args: Prisma.NotificationEventFindManyArgs
  ): Promise<PrismaNotificationEvent[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .notifEvents(args);
  }

  async findScheduleChangesDecided(
    parentId: string,
    args: Prisma.ScheduleChangeRequestFindManyArgs
  ): Promise<PrismaScheduleChangeRequest[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .scheduleChangesDecided(args);
  }

  async findScheduleChangesRequested(
    parentId: string,
    args: Prisma.ScheduleChangeRequestFindManyArgs
  ): Promise<PrismaScheduleChangeRequest[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .scheduleChangesRequested(args);
  }

  async findStatusActions(
    parentId: string,
    args: Prisma.DeliveryStatusHistoryFindManyArgs
  ): Promise<PrismaDeliveryStatusHistory[]> {
    return this.prisma.user
      .findUniqueOrThrow({ where: { id: parentId } })
      .statusActions(args);
  }

  async getCustomer(parentId: string): Promise<any | null> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: parentId },
      select: {
        customer: {
          select: {
            id: true,
            approvalStatus: true,
            approvedAt: true,
            approvedByUserId: true,
            businessAddress: true,
            businessName: true,
            businessPhone: true,
            businessPlaceId: true,
            businessWebsite: true,
            contactEmail: true,
            contactName: true,
            contactPhone: true,
            createdAt: true,
            customerType: true,
            defaultPickupId: true,
            phone: true,
            postpaidEnabled: true,
            pricingConfigId: true,
            pricingModeOverride: true,
            suspendedAt: true,
            suspensionReason: true,
            updatedAt: true,
            userId: true,
          },
        },
      },
    });

    return user.customer;
  }

  async getDriver(parentId: string): Promise<any | null> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: parentId },
      select: {
        driver: {
          select: {
            id: true,
            approvedAt: true,
            approvedByUserId: true,
            createdAt: true,
            phone: true,
            profilePhotoUrl: true,
            status: true,
            updatedAt: true,
            userId: true,
          },
        },
      },
    });

    return user.driver;
  }

  private normalizeCreateData(
    data: Prisma.UserCreateArgs["data"]
  ): Prisma.UserCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.email = this.trimRequiredString(normalized.email);
    normalized.username = this.trimRequiredString(normalized.username);
    normalized.password = this.trimRequiredString(normalized.password);

    normalized.fullName = this.trimOptionalString(normalized.fullName);
    normalized.phone = this.trimOptionalString(normalized.phone);
    normalized.passwordHash = this.trimOptionalString(normalized.passwordHash);
    normalized.disabledReason = this.trimOptionalString(normalized.disabledReason);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.UserUpdateArgs["data"]
  ): Prisma.UserUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "email", false);
    this.normalizeUpdateStringField(normalized, "username", false);
    this.normalizeUpdateStringField(normalized, "password", false);

    this.normalizeUpdateStringField(normalized, "fullName", true);
    this.normalizeUpdateStringField(normalized, "phone", true);
    this.normalizeUpdateStringField(normalized, "passwordHash", true);
    this.normalizeUpdateStringField(normalized, "disabledReason", true);

    return normalized;
  }

  private trimRequiredString(value: unknown): string {
    if (typeof value !== "string") {
      return value as string;
    }

    return value.trim();
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
    field: string,
    allowNull: boolean
  ): void {
    if (!(field in target)) {
      return;
    }

    const raw = target[field];

    if (raw && typeof raw === "object" && "set" in raw) {
      target[field] = {
        ...raw,
        set: allowNull
          ? this.trimOptionalString(raw.set)
          : this.trimRequiredString(raw.set),
      };
      return;
    }

    target[field] = allowNull
      ? this.trimOptionalString(raw)
      : this.trimRequiredString(raw);
  }
async getAdminUsers(query: {
  q?: string;
  roles?: string;
  isActive?: boolean;
  hasCustomer?: boolean;
  hasDriver?: boolean;
  customerType?: string;
  customerApprovalStatus?: string;
  driverStatus?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}): Promise<any> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {
    // ── Exclude pending (unverified) signups ──────────────────────────
    // Users who started a signup but never verified their email with OTP
    // (emailVerifiedAt=null, no Customer, no Driver) should NOT appear in
    // the admin users list. They're incomplete registrations that will be
    // cleaned up automatically or completed when the user verifies.
    // Admins don't need to see or manage these.
    NOT: {
      emailVerifiedAt: null,
      customer: null,
      driver: null,
    },
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" } },
            { username: { contains: query.q, mode: "insensitive" } },
            { fullName: { contains: query.q, mode: "insensitive" } },
            { phone: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.roles
      ? { roles: query.roles as EnumUserRoles }
      : {}),
    ...(typeof query.isActive === "boolean"
      ? { isActive: query.isActive }
      : {}),
    ...(typeof query.hasCustomer === "boolean"
      ? { customer: query.hasCustomer ? { isNot: null } : null }
      : {}),
    ...(typeof query.hasDriver === "boolean"
      ? { driver: query.hasDriver ? { isNot: null } : null }
      : {}),
    ...(query.createdFrom || query.createdTo
      ? {
          createdAt: {
            ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
            ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
          },
        }
      : {}),
    ...((query.customerType || query.customerApprovalStatus)
      ? {
          customer: {
            is: {
              ...(query.customerType
                ? {
                    customerType:
                      query.customerType as EnumCustomerCustomerType,
                  }
                : {}),
              ...(query.customerApprovalStatus
                ? {
                    approvalStatus:
                      query.customerApprovalStatus as EnumCustomerApprovalStatus,
                  }
                : {}),
            },
          },
        }
      : {}),
    ...(query.driverStatus
      ? {
          driver: {
            is: {
              status: query.driverStatus as EnumDriverStatus,
            },
          },
        }
      : {}),
  };

  const total = await this.prisma.user.count({ where });

  const rows = await this.prisma.user.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: {
      [query.sortBy || "createdAt"]: query.sortOrder || "desc",
    } as Prisma.UserOrderByWithRelationInput,
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      phone: true,
      roles: true,
      isActive: true,
      disabledAt: true,
      disabledReason: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          customerType: true,
          approvalStatus: true,
          businessName: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          phone: true,
          suspendedAt: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      driver: {
        select: {
          id: true,
          status: true,
          phone: true,
          profilePhotoUrl: true,
          approvedAt: true,
          approvedByUserId: true,
          createdAt: true,
          updatedAt: true,
          // Referral relationship — show the referrer's name + the
          // referral code used (if this driver was referred).
          referredBy: {
            select: {
              id: true,
              referralCode: true,
              status: true,
              referrer: {
                select: {
                  id: true,
                  user: { select: { fullName: true } },
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          deliveriesCreated: true,
          adminActions: true,
          notifEvents: true,
          scheduleChangesRequested: true,
          scheduleChangesDecided: true,
        },
      },
    },
  });

  return {
    filtersApplied: {
      q: query.q ?? null,
      roles: query.roles ?? null,
      isActive: query.isActive ?? null,
      hasCustomer: query.hasCustomer ?? null,
      hasDriver: query.hasDriver ?? null,
      customerType: query.customerType ?? null,
      customerApprovalStatus: query.customerApprovalStatus ?? null,
      driverStatus: query.driverStatus ?? null,
      createdFrom: query.createdFrom ?? null,
      createdTo: query.createdTo ?? null,
      sortBy: query.sortBy ?? "createdAt",
      sortOrder: query.sortOrder ?? "desc",
    },
    rows,
    pagination: {
      page,
      pageSize,
      totalRows: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

async getAdminUsersSummary(): Promise<any> {
  // Same filter as getAdminUsers — exclude pending (unverified) signups
  // from all counts so the admin dashboard numbers match the list.
  const verifiedFilter = {
    NOT: {
      emailVerifiedAt: null,
      customer: null,
      driver: null,
    },
  } as Prisma.UserWhereInput;

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    privateCustomers,
    businessCustomers,
    drivers,
    admins,
    pendingCustomers,
    pendingDrivers,
  ] = await Promise.all([
    this.prisma.user.count({ where: verifiedFilter }),
    this.prisma.user.count({ where: { ...verifiedFilter, isActive: true } }),
    this.prisma.user.count({ where: { ...verifiedFilter, isActive: false } }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.PRIVATE_CUSTOMER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.BUSINESS_CUSTOMER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.DRIVER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.ADMIN },
    }),
    this.prisma.customer.count({
      where: { approvalStatus: EnumCustomerApprovalStatus.PENDING },
    }),
    this.prisma.driver.count({
      where: {
        status: {
          in: [
            EnumDriverStatus.WAITLISTED,
            EnumDriverStatus.INVITED,
            EnumDriverStatus.PENDING_APPROVAL,
          ],
        },
      },
    }),
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    byRole: {
      privateCustomers,
      businessCustomers,
      drivers,
      admins,
    },
    pendingApprovals: {
      customers: pendingCustomers,
      drivers: pendingDrivers,
    },
  };
}

// ============================================================
// V2 — Unified admin users endpoint
// ============================================================
// Replaces the separate /admin + /admin/summary endpoints with a
// single call that returns summary + rows + pagination + availableStatuses.
//
// Key change: the `status` param is UNIFIED. Instead of separate
// customerApprovalStatus + driverStatus params, there's ONE `status`
// that maps to both sides:
//   PENDING     → Customer.approvalStatus = PENDING
//                 OR Driver.status IN (WAITLISTED, INVITED, PENDING_APPROVAL)
//   APPROVED    → Customer.approvalStatus = APPROVED OR Driver.status = APPROVED
//   REJECTED    → Customer.approvalStatus = REJECTED OR Driver.status = REJECTED
//   SUSPENDED   → Customer.approvalStatus = SUSPENDED OR Driver.status = SUSPENDED
//   INVITED     → Driver.status = INVITED (driver-only)
//   WAITLISTED  → Driver.status = WAITLISTED (driver-only)
//
// When status=PENDING, the query ORs both customer + driver conditions
// so the table shows the same count as the summary's "Pending Approvals"
// card. No more "14 in summary, 3 in filter" mismatch.
//
// Driver-only statuses (INVITED, WAITLISTED) auto-force roles=DRIVER
// server-side so the query doesn't waste time scanning customer rows.
// The response includes `availableStatuses` so the frontend can
// disable driver-only options when role=customer is selected.
async getAdminUsersV2(query: {
  q?: string;
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}): Promise<any> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  // ── Build the unified where clause ──────────────────────────────
  // The base filter excludes unverified signups (same as V1).
  const verifiedFilter = {
    NOT: {
      emailVerifiedAt: null,
      customer: null,
      driver: null,
    },
  } as Prisma.UserWhereInput;

  const where: Prisma.UserWhereInput = {
    ...verifiedFilter,
    // Search
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" } },
            { username: { contains: query.q, mode: "insensitive" } },
            { fullName: { contains: query.q, mode: "insensitive" } },
            { phone: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // ── Role filter ─────────────────────────────────────────────────
  // If status is a driver-only value (INVITED, WAITLISTED), force
  // roles=DRIVER server-side so we don't scan customer rows that can
  // never match.
  const driverOnlyStatuses = ["INVITED", "WAITLISTED"];
  const isDriverOnlyStatus = query.status
    ? driverOnlyStatuses.includes(query.status)
    : false;

  if (query.role) {
    where.roles = query.role as EnumUserRoles;
  } else if (isDriverOnlyStatus) {
    // Auto-force driver role for driver-only statuses
    where.roles = EnumUserRoles.DRIVER;
  }

  // ── Unified status filter ───────────────────────────────────────
  // This is the core V2 change: instead of separate customerApprovalStatus
  // + driverStatus, we have ONE `status` that ORs both sides.
  //
  // The mapping:
  //   PENDING     → customer.PENDING OR driver IN (WAITLISTED, INVITED, PENDING_APPROVAL)
  //   APPROVED    → customer.APPROVED OR driver.APPROVED
  //   REJECTED    → customer.REJECTED OR driver.REJECTED
  //   SUSPENDED   → customer.SUSPENDED OR driver.SUSPENDED
  //   INVITED     → driver.INVITED (driver-only — role auto-forced above)
  //   WAITLISTED  → driver.WAITLISTED (driver-only — role auto-forced above)
  //
  // For PENDING/APPROVED/REJECTED/SUSPENDED, we build an OR condition
  // that matches either the customer side OR the driver side. This
  // ensures "Pending" shows both pending customers + pending drivers
  // in one query — matching the summary card.
  if (query.status) {
    const status = query.status;

    if (status === "PENDING") {
      // The broadest case — matches Customer.PENDING + 3 driver statuses
      where.OR = [
        {
          customer: {
            is: { approvalStatus: EnumCustomerApprovalStatus.PENDING },
          },
        },
        {
          driver: {
            is: {
              status: {
                in: [
                  EnumDriverStatus.WAITLISTED,
                  EnumDriverStatus.INVITED,
                  EnumDriverStatus.PENDING_APPROVAL,
                ],
              },
            },
          },
        },
      ];
    } else if (status === "APPROVED") {
      where.OR = [
        {
          customer: {
            is: { approvalStatus: EnumCustomerApprovalStatus.APPROVED },
          },
        },
        {
          driver: {
            is: { status: EnumDriverStatus.APPROVED },
          },
        },
      ];
    } else if (status === "REJECTED") {
      where.OR = [
        {
          customer: {
            is: { approvalStatus: EnumCustomerApprovalStatus.REJECTED },
          },
        },
        {
          driver: {
            is: { status: EnumDriverStatus.REJECTED },
          },
        },
      ];
    } else if (status === "SUSPENDED") {
      where.OR = [
        {
          customer: {
            is: { approvalStatus: EnumCustomerApprovalStatus.SUSPENDED },
          },
        },
        {
          driver: {
            is: { status: EnumDriverStatus.SUSPENDED },
          },
        },
      ];
    } else if (status === "INVITED") {
      // Driver-only — role already auto-forced above
      where.driver = {
        is: { status: EnumDriverStatus.INVITED },
      };
    } else if (status === "WAITLISTED") {
      // Driver-only — role already auto-forced above
      where.driver = {
        is: { status: EnumDriverStatus.WAITLISTED },
      };
    }
  }

  // ── Run the query + count in parallel ───────────────────────────
  const [total, rows, totalUsers, activeUsers, inactiveUsers,
    privateCustomers, businessCustomers, drivers, admins,
    pendingCustomers, pendingDrivers] = await Promise.all([
    // Filtered count (matches the table)
    this.prisma.user.count({ where }),
    // Filtered rows
    this.prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        [query.sortBy || "createdAt"]: query.sortOrder || "desc",
      } as Prisma.UserOrderByWithRelationInput,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phone: true,
        roles: true,
        isActive: true,
        disabledAt: true,
        disabledReason: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            approvalStatus: true,
            businessName: true,
            contactName: true,
            contactEmail: true,
            contactPhone: true,
            phone: true,
            suspendedAt: true,
            approvedAt: true,
            postpaidEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        driver: {
          select: {
            id: true,
            status: true,
            phone: true,
            profilePhotoUrl: true,
            approvedAt: true,
            approvedByUserId: true,
            createdAt: true,
            updatedAt: true,
            referredBy: {
              select: {
                id: true,
                referralCode: true,
                status: true,
                referrer: {
                  select: {
                    id: true,
                    user: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            deliveriesCreated: true,
            adminActions: true,
            notifEvents: true,
            scheduleChangesRequested: true,
            scheduleChangesDecided: true,
          },
        },
      },
    }),
    // ── Global summary (always full platform counts, unaffected by filters) ──
    this.prisma.user.count({ where: verifiedFilter }),
    this.prisma.user.count({ where: { ...verifiedFilter, isActive: true } }),
    this.prisma.user.count({ where: { ...verifiedFilter, isActive: false } }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.PRIVATE_CUSTOMER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.BUSINESS_CUSTOMER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.DRIVER },
    }),
    this.prisma.user.count({
      where: { ...verifiedFilter, roles: EnumUserRoles.ADMIN },
    }),
    // Pending counts (same logic as the old summary endpoint)
    this.prisma.customer.count({
      where: { approvalStatus: EnumCustomerApprovalStatus.PENDING },
    }),
    this.prisma.driver.count({
      where: {
        status: {
          in: [
            EnumDriverStatus.WAITLISTED,
            EnumDriverStatus.INVITED,
            EnumDriverStatus.PENDING_APPROVAL,
          ],
        },
      },
    }),
  ]);

  // ── Build the response ──────────────────────────────────────────
  // The summary's filteredTotal always equals pagination.totalRows —
  // so the summary card + the table always match.
  return {
    // Global summary (always full platform counts — doesn't change with filters)
    summary: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      byRole: {
        privateCustomers,
        businessCustomers,
        drivers,
        admins,
      },
      pendingApprovals: {
        customers: pendingCustomers,
        drivers: pendingDrivers,
      },
      // The total that matches the current filter — this is what the
      // "Showing X of Y" footer should display.
      filteredTotal: total,
    },
    // The table rows
    rows,
    pagination: {
      page,
      pageSize,
      totalRows: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
    // What filters were applied (for the "Active filters" display)
    filtersApplied: {
      q: query.q ?? null,
      role: isDriverOnlyStatus && !query.role
        ? "DRIVER" // reflect the auto-forced role
        : query.role ?? null,
      status: query.status ?? null,
      // Flag: was the role auto-forced because of a driver-only status?
      roleAutoForced: isDriverOnlyStatus && !query.role,
      sortBy: query.sortBy ?? "createdAt",
      sortOrder: query.sortOrder ?? "desc",
    },
    // Which status options are available given the current role selection.
    // The frontend uses this to enable/disable filter options.
    availableStatuses: {
      // All 6 unified statuses
      all: [
        { value: "PENDING", label: "Pending", driverOnly: false },
        { value: "APPROVED", label: "Approved", driverOnly: false },
        { value: "REJECTED", label: "Rejected", driverOnly: false },
        { value: "SUSPENDED", label: "Suspended", driverOnly: false },
        { value: "INVITED", label: "Invited", driverOnly: true },
        { value: "WAITLISTED", label: "Waitlisted", driverOnly: true },
      ],
      // Which values are driver-only (not applicable to customers)
      driverOnly: ["INVITED", "WAITLISTED"],
    },
  };
}

async getAdminUserDetail(id: string): Promise<any> {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      phone: true,
      roles: true,
      isActive: true,
      disabledAt: true,
      disabledReason: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,

      customer: {
        select: {
          id: true,
          approvalStatus: true,
          approvedAt: true,
          approvedByUserId: true,
          businessAddress: true,
          businessName: true,
          businessPhone: true,
          businessPlaceId: true,
          businessWebsite: true,
          contactEmail: true,
          contactName: true,
          contactPhone: true,
          customerType: true,
          defaultPickupId: true,
          phone: true,
          postpaidEnabled: true,
          pricingConfigId: true,
          pricingModeOverride: true,
          // Include the full pricingConfig relation so the admin-user-detail
          // page can render the "Pricing & Billing" card (item 6) without a
          // separate fetch. Selects only the fields the UI needs — keeps the
          // payload small while avoiding an N+1 round trip.
          pricingConfig: {
            select: {
              id: true,
              name: true,
              pricingMode: true,
              baseFee: true,
              perMileRate: true,
              flatMiles: true,
              insuranceFee: true,
              transactionFeePct: true,
              transactionFeeFixed: true,
              feePassThrough: true,
              driverSharePct: true,
              active: true,
              isDefault: true,
            },
          },
          suspendedAt: true,
          suspensionReason: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              addresses: true,
              deliveries: true,
              notifications: true,
              ratings: true,
              vehicles: true,
            },
          },
          addresses: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              label: true,
              address: true,
              city: true,
              state: true,
              postalCode: true,
              lat: true,
              lng: true,
              isDefault: true,
              createdAt: true,
            },
          },
          vehicles: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              make: true,
              model: true,
              color: true,
              licensePlate: true,
              createdAt: true,
            },
          },
        },
      },

      driver: {
        select: {
          id: true,
          approvedAt: true,
          approvedByUserId: true,
          phone: true,
          profilePhotoUrl: true,
          selfiePhotoUrl: true,
          status: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          dateOfBirth: true,
          ssnLastFour: true,
          licenseNumber: true,
          licenseState: true,
          licenseFrontUrl: true,
          licenseBackUrl: true,
          residentialAddressLine1: true,
          residentialAddressLine2: true,
          residentialCity: true,
          residentialState: true,
          residentialZip: true,
          location: {
            select: {
              id: true,
              currentLat: true,
              currentLng: true,
              currentAt: true,
              homeBaseLat: true,
              homeBaseLng: true,
              homeBaseCity: true,
              homeBaseState: true,
            },
          },
          preferences: {
            select: {
              id: true,
              city: true,
              radiusMiles: true,
            },
          },
          alerts: {
            select: {
              id: true,
              enabled: true,
              emailEnabled: true,
              smsEnabled: true,
            },
          },
          // Referral relationship — present if this driver was referred
          // by another driver. Exposed in the admin detail view so the
          // admin can see who referred this driver, what code was used,
          // the referral status, the trip progress, and the reward amount.
          referredBy: {
            select: {
              id: true,
              referralCode: true,
              status: true,
              tripsCompleted: true,
              requiredDeliveries: true,
              rewardTrigger: true,
              expiresAt: true,
              referredGetsReward: true,
              referredRewardAmount: true,
              referredRewardPaidAt: true,
              createdAt: true,
              referrer: {
                select: {
                  id: true,
                  user: { select: { fullName: true, email: true } },
                },
              },
            },
          },
          _count: {
            select: {
              assignments: true,
              notifications: true,
              payouts: true,
              ratingsReceived: true,
              districts: true,
            },
          },
        },
      },

      _count: {
        select: {
          adminActions: true,
          assignmentsMade: true,
          auditTargets: true,
          compliancesVerified: true,
          customersApproved: true,
          deliveriesCreated: true,
          disputeNotesAuthored: true,
          driversApproved: true,
          exportsCreated: true,
          notifEvents: true,
          scheduleChangesDecided: true,
          scheduleChangesRequested: true,
          statusActions: true,
        },
      },
    },
  });

  const [
    recentAdminActions,
    recentNotifications,
    recentDeliveriesCreated,
    recentScheduleChangesRequested,
    recentScheduleChangesDecided,
  ] = await Promise.all([
    this.prisma.adminAuditLog.findMany({
      where: {
        OR: [{ actorUserId: id }, { userId: id }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        actorUserId: true,
        actorType: true,
        customerId: true,
        deliveryId: true,
        driverId: true,
        reason: true,
        createdAt: true,
      },
    }),
    this.prisma.notificationEvent.findMany({
      where: { actorUserId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        subject: true,
        toEmail: true,
        toPhone: true,
        deliveryId: true,
        createdAt: true,
        sentAt: true,
        failedAt: true,
      },
    }),
    this.prisma.deliveryRequest.findMany({
      where: { createdByUserId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        serviceType: true,
        pickupAddress: true,
        dropoffAddress: true,
        createdAt: true,
      },
    }),
    this.prisma.scheduleChangeRequest.findMany({
      where: { requestedByUserId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        deliveryId: true,
        status: true,
        reason: true,
        requestedByRole: true,
        createdAt: true,
      },
    }),
    this.prisma.scheduleChangeRequest.findMany({
      where: { decidedByUserId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        deliveryId: true,
        status: true,
        decisionNote: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    ...user,
    recentAdminActions,
    recentNotifications,
    recentDeliveriesCreated,
    recentScheduleChangesRequested,
    recentScheduleChangesDecided,
  };
}
async adminUpdateUser(input: {
  userId: string;
  email?: string;
  username?: string;
  fullName?: string | null;
  phone?: string | null;
  customer?: {
    phone?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    defaultPickupId?: string | null;
    postpaidEnabled?: boolean;
  };
  driver?: {
    phone?: string | null;
    profilePhotoUrl?: string | null;
    selfiePhotoUrl?: string | null;
    residentialZip?: string | null;
  };
}): Promise<any> {
  const existing = await this.prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: {
      id: true,
      customer: {
        select: {
          id: true,
          customerType: true,
        },
      },
      driver: {
        select: {
          id: true,
        },
      },
    },
  });

  const userData: Prisma.UserUpdateInput = {};
  if (input.email !== undefined) userData.email = input.email.trim();
  if (input.username !== undefined) userData.username = input.username.trim();
  if (input.fullName !== undefined) userData.fullName = this.trimOptionalString(input.fullName);
  if (input.phone !== undefined) userData.phone = this.trimOptionalString(input.phone);

  await this.prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      const normalizedUserData = stripEmptyObjectsDeep(userData) as Prisma.UserUpdateInput;
      await this.policy.beforeUpdate(tx as any, input.userId, normalizedUserData);

      await tx.user.update({
        where: { id: input.userId },
        data: normalizedUserData,
      });
    }

    if (input.customer) {
      if (!existing.customer) {
        throw new Error("This user is not linked to a customer");
      }

      const customerData: Prisma.CustomerUpdateInput = {};

      if (input.customer.phone !== undefined) {
        customerData.phone = this.trimOptionalString(input.customer.phone);
      }
      if (input.customer.contactName !== undefined) {
        customerData.contactName = this.trimOptionalString(input.customer.contactName);
      }
      if (input.customer.contactEmail !== undefined) {
        customerData.contactEmail = this.trimOptionalString(input.customer.contactEmail);
      }
      if (input.customer.contactPhone !== undefined) {
        customerData.contactPhone = this.trimOptionalString(input.customer.contactPhone);
      }
      if (input.customer.defaultPickupId !== undefined) {
        customerData.defaultPickup =
          input.customer.defaultPickupId === null
            ? { disconnect: true }
            : { connect: { id: input.customer.defaultPickupId } };
      }

      // optional: allow for both private and business customer
      if (input.customer.postpaidEnabled !== undefined) {
        customerData.postpaidEnabled = input.customer.postpaidEnabled;
      }

      const forbiddenBusinessFields = [
        "businessName",
        "businessAddress",
        "businessPhone",
        "businessWebsite",
        "businessPlaceId",
      ];

      for (const key of forbiddenBusinessFields) {
        if ((input.customer as any)[key] !== undefined) {
          throw new Error(`${key} is not editable from admin user update`);
        }
      }

      if (Object.keys(customerData).length > 0) {
        await tx.customer.update({
          where: { id: existing.customer.id },
          data: stripEmptyObjectsDeep(customerData) as Prisma.CustomerUpdateInput,
        });
      }
    }

    if (input.driver) {
      if (!existing.driver) {
        throw new Error("This user is not linked to a driver");
      }

      const driverData: Prisma.DriverUpdateInput = {};

      if (input.driver.phone !== undefined) {
        driverData.phone = this.trimOptionalString(input.driver.phone);
      }
      if (input.driver.profilePhotoUrl !== undefined) {
        driverData.profilePhotoUrl = this.trimOptionalString(
          input.driver.profilePhotoUrl
        );
      }
      if (input.driver.selfiePhotoUrl !== undefined) {
        driverData.selfiePhotoUrl = this.trimOptionalString(
          input.driver.selfiePhotoUrl
        );
      }
      if (input.driver.residentialZip !== undefined) {
        driverData.residentialZip = this.trimOptionalString(
          input.driver.residentialZip
        );
      }

      if (Object.keys(driverData).length > 0) {
        await tx.driver.update({
          where: { id: existing.driver.id },
          data: stripEmptyObjectsDeep(driverData) as Prisma.DriverUpdateInput,
        });
      }
    }
  });

  return this.getAdminUserDetail(input.userId);
}

async suspendUser(input: {
  id: string;
  reason?: string | null;
  actorUserId?: string | null;
}): Promise<any> {
  const updateData: Prisma.UserUpdateInput = {
    isActive: false,
    disabledAt: new Date(),
    disabledReason: input.reason ?? "Suspended by admin",
  };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.user.update({
    where: { id: input.id },
    data: updateData,
  });

  if (input.actorUserId) {
    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.USER_DISABLE,
        actorUserId: input.actorUserId,
        actorType: EnumAdminAuditLogActorType.USER,
        userId: input.id,
        reason: input.reason ?? "Suspended by admin",
      },
    });
  }

  return this.domain.findUnique({ id: updated.id });
}

async unsuspendUser(input: {
  id: string;
  actorUserId?: string | null;
}): Promise<any> {
  const updateData: Prisma.UserUpdateInput = {
    isActive: true,
    disabledAt: null,
    disabledReason: null,
  };

  await this.policy.beforeUpdate(this.prisma as any, input.id, updateData);

  const updated = await this.prisma.user.update({
    where: { id: input.id },
    data: updateData,
  });

  if (input.actorUserId) {
    await this.prisma.adminAuditLog.create({
      data: {
        action: EnumAdminAuditLogAction.USER_ENABLE,
        actorUserId: input.actorUserId,
        actorType: EnumAdminAuditLogActorType.USER,
        userId: input.id,
        reason: "Unsuspended by admin",
      },
    });
  }

  return this.domain.findUnique({ id: updated.id });
}  

async approveCustomerFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  postpaidEnabled?: boolean;
  note?: string | null;
}) {
  const customer = await this.getUserCustomerOrThrow(input.userId);

  // approveCustomer may return a `postpaidSetupWarning` field if the
  // admin approved the customer as postpaid but the Stripe auto-setup
  // failed (the customer is approved as prepaid instead). We forward
  // this warning up to the API response so the admin frontend can show
  // a toast with the explanation + remediation steps.
  const approveResult: any = await this.customerService.approveCustomer({
    customerId: customer.id,
    actorUserId: input.actorUserId ?? null,
    postpaidEnabled: input.postpaidEnabled === true,
    note: input.note ?? null,
  });

  const userDetail = await this.getAdminUserDetail(input.userId);
  // Attach the warning (if any) to the response. The frontend reads
  // `postpaidSetupWarning` from the API response and shows a toast.
  if (approveResult?.postpaidSetupWarning) {
    (userDetail as any).postpaidSetupWarning =
      approveResult.postpaidSetupWarning;
  }
  return userDetail;
}

async rejectCustomerFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  reason?: string | null;
}) {
  const customer = await this.getUserCustomerOrThrow(input.userId);

  await this.customerService.rejectCustomer({
    customerId: customer.id,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async suspendCustomerFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  reason: string;
}) {
  const customer = await this.getUserCustomerOrThrow(input.userId);

  await this.customerService.suspendCustomer({
    customerId: customer.id,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason,
  });

  return this.getAdminUserDetail(input.userId);
}

async unsuspendCustomerFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const customer = await this.getUserCustomerOrThrow(input.userId);

  await this.customerService.unsuspendCustomer({
    customerId: customer.id,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async approveDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.approveDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async rejectDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  reason?: string | null;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.rejectDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async suspendDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  reason: string;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.suspendDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason,
  });

  return this.getAdminUserDetail(input.userId);
}

async unsuspendDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.unsuspendDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async inviteDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.inviteDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

async resendInviteDriverFromUser(input: {
  userId: string;
  actorUserId?: string | null;
  note?: string | null;
}) {
  const driver = await this.getUserDriverOrThrow(input.userId);

  await this.driverService.resendInviteDriver({
    driverId: driver.id,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.getAdminUserDetail(input.userId);
}

private async getUserCustomerOrThrow(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      customer: {
        select: { id: true },
      },
    },
  });

  if (!user.customer) {
    throw new BadRequestException("This user is not linked to a customer");
  }

  return user.customer;
}

private async getUserDriverOrThrow(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      driver: {
        select: { id: true },
      },
    },
  });

  if (!user.driver) {
    throw new BadRequestException("This user is not linked to a driver");
  }

  return user.driver;
}
async userLookupList(): Promise<
  {
    id: string;
    name: string | null;
    email: string;
    username: string;
    roles: EnumUserRoles;
    isActive: boolean;
  }[]
> {
  const rows = await this.prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      username: true,
      roles: true,
      isActive: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.fullName ?? null,
    email: row.email,
    username: row.username,
    roles: row.roles,
    isActive: row.isActive,
  }));
}

async adminCreateUser(input: {
  email: string;
  username: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
  isActive?: boolean;
  actorUserId?: string | null;
}): Promise<any> {
  const plainPassword = this.trimRequiredString(input.password);
  const passwordHash = await this.passwordService.hash(plainPassword);

  const normalizedData = stripEmptyObjectsDeep(
    this.normalizeCreateData({
      email: input.email,
      username: input.username,
      password: plainPassword,
      passwordHash,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      roles: EnumUserRoles.ADMIN,
      isActive: input.isActive ?? true,
      disabledAt: input.isActive === false ? new Date() : null,
      disabledReason:
        input.isActive === false ? "Created inactive by admin" : null, 
    } as Prisma.UserCreateInput)
  ) as Prisma.UserCreateInput;

  await this.policy.beforeCreate(this.prisma as any, normalizedData);

  const created = await this.prisma.user.create({
    data: normalizedData,
    select: { id: true },
  });

  if (input.actorUserId) {
    await this.prisma.adminAuditLog.create({
      data: {
        action:
          input.isActive === false
            ? EnumAdminAuditLogAction.USER_DISABLE
            : EnumAdminAuditLogAction.OTHER,
        actorUserId: input.actorUserId,
        actorType: EnumAdminAuditLogActorType.USER,
        userId: created.id,
        reason:
          input.isActive === false
            ? "Admin user created as inactive"
            : "Admin user created",
      },
    });
  }

  return this.getAdminUserDetail(created.id);
}
}
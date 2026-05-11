// src/driver/driver.service.ts

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AdminAuditLog as PrismaAdminAuditLog,
  DeliveryAssignment as PrismaDeliveryAssignment,
  DeliveryRating as PrismaDeliveryRating,
  Driver as PrismaDriver,
  DriverAlertPreference as PrismaDriverAlertPreference,
  DriverDistrictPreference as PrismaDriverDistrictPreference,
  DriverPayout as PrismaDriverPayout,
  DriverPreference as PrismaDriverPreference,
  NotificationEvent as PrismaNotificationEvent,
  Prisma,
  User as PrismaUser,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { DriverServiceBase } from "./base/driver.service.base";
import { DriverDomain } from "../domain/driver/driver.domain";
import { DriverPolicyService } from "../domain/driver/driverPolicy.service";
import { UpdateDriverProfileBody } from "./dto/driverProfile.dto";
import { EnumDriverStatus } from "@prisma/client";
import { DriverApprovalEngine } from "../domain/driver/driverApproval.engine";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";

@Injectable()
export class DriverService extends DriverServiceBase {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly domain: DriverDomain,
    private readonly policy: DriverPolicyService,
    private readonly driverApprovalEngine: DriverApprovalEngine

  ) {
    super(prisma);
  }

  async count(args: Omit<Prisma.DriverCountArgs, "select"> = {}): Promise<number> {
    return this.prisma.driver.count(args);
  }

  async drivers(args: Prisma.DriverFindManyArgs): Promise<any[]> {
    return this.domain.findMany(args);
  }

  async driver(args: Prisma.DriverFindUniqueArgs): Promise<any | null> {
    return this.domain.findUnique(args.where, args.select);
  }

  async createDriver(args: Prisma.DriverCreateArgs): Promise<any> {
    const normalizedData = this.normalizeCreateData(args.data);

    await this.policy.beforeCreate(this.prisma as any, normalizedData);

    const created = await this.prisma.driver.create({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: created.id });
  }

  async updateDriver(args: Prisma.DriverUpdateArgs): Promise<any> {
    const normalizedData = this.normalizeUpdateData(args.data);

    await this.policy.beforeUpdate(
      this.prisma as any,
      (args.where as any)?.id,
      normalizedData
    );

    const updated = await this.prisma.driver.update({
      ...args,
      data: normalizedData,
    });

    return this.domain.findUnique({ id: updated.id });
  }

  async deleteDriver(args: Prisma.DriverDeleteArgs): Promise<PrismaDriver> {
    await this.policy.beforeDelete(this.prisma as any, (args.where as any)?.id);
    return this.prisma.driver.delete(args);
  }

  async findAssignments(
    parentId: string,
    args: Prisma.DeliveryAssignmentFindManyArgs
  ): Promise<PrismaDeliveryAssignment[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .assignments(args);
  }

  async findAudits(
    parentId: string,
    args: Prisma.AdminAuditLogFindManyArgs
  ): Promise<PrismaAdminAuditLog[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .audits(args);
  }

  async findDistricts(
    parentId: string,
    args: Prisma.DriverDistrictPreferenceFindManyArgs
  ): Promise<PrismaDriverDistrictPreference[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .districts(args);
  }

  async findNotifications(
    parentId: string,
    args: Prisma.NotificationEventFindManyArgs
  ): Promise<PrismaNotificationEvent[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .notifications(args);
  }

  async findPayouts(
    parentId: string,
    args: Prisma.DriverPayoutFindManyArgs
  ): Promise<PrismaDriverPayout[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .payouts(args);
  }

  async findRatingsReceived(
    parentId: string,
    args: Prisma.DeliveryRatingFindManyArgs
  ): Promise<PrismaDeliveryRating[]> {
    return this.prisma.driver
      .findUniqueOrThrow({ where: { id: parentId } })
      .ratingsReceived(args);
  }

  async getAlerts(parentId: string): Promise<PrismaDriverAlertPreference | null> {
    return this.prisma.driver.findUnique({ where: { id: parentId } }).alerts();
  }

  async getApprovedBy(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.driver.findUnique({ where: { id: parentId } }).approvedBy();
  }

  async getPreferences(parentId: string): Promise<PrismaDriverPreference | null> {
    return this.prisma.driver.findUnique({ where: { id: parentId } }).preferences();
  }

  async getUser(parentId: string): Promise<PrismaUser | null> {
    return this.prisma.driver.findUnique({ where: { id: parentId } }).user();
  }

  private normalizeCreateData(
    data: Prisma.DriverCreateArgs["data"]
  ): Prisma.DriverCreateArgs["data"] {
    const normalized: any = { ...data };

    normalized.phone = this.trimOptionalString(normalized.phone);
    normalized.profilePhotoUrl = this.trimOptionalString(normalized.profilePhotoUrl);

    return normalized;
  }

  private normalizeUpdateData(
    data: Prisma.DriverUpdateArgs["data"]
  ): Prisma.DriverUpdateArgs["data"] {
    const normalized: any = { ...data };

    this.normalizeUpdateStringField(normalized, "phone");
    this.normalizeUpdateStringField(normalized, "profilePhotoUrl");

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
  async updateDriverProfile(
    driverId: string,
    body: UpdateDriverProfileBody
  ): Promise<any> {
    const existing = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        preferences: { select: { id: true } },
        alerts: { select: { id: true } },
        location: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new Error(`Driver '${driverId}' not found`);
    }

    const normalizedPhone = this.trimOptionalString(body.phone);
    const normalizedProfilePhotoUrl = this.trimOptionalString(
      body.profilePhotoUrl
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driverId },
        data: {
          ...(body.phone !== undefined ? { phone: normalizedPhone } : {}),
          ...(body.profilePhotoUrl !== undefined
            ? { profilePhotoUrl: normalizedProfilePhotoUrl }
            : {}),
        },
      });

      if (body.preferences) {
        const prefData = {
          city: this.trimOptionalString(body.preferences.city),
          radiusMiles:
            body.preferences.radiusMiles === undefined
              ? undefined
              : body.preferences.radiusMiles,
        };

        if (existing.preferences?.id) {
          await tx.driverPreference.update({
            where: { driverId },
            data: prefData,
          });
        } else {
          await tx.driverPreference.create({
            data: {
              driver: { connect: { id: driverId } },
              ...prefData,
            },
          });
        }
      }

if (body.alerts) {
  const alertData: Prisma.DriverAlertPreferenceUpdateInput = {
    ...(body.alerts.enabled !== undefined
      ? { enabled: body.alerts.enabled }
      : {}),
    ...(body.alerts.emailEnabled !== undefined
      ? { emailEnabled: body.alerts.emailEnabled }
      : {}),
    ...(body.alerts.smsEnabled !== undefined
      ? { smsEnabled: body.alerts.smsEnabled }
      : {}),
  };

  if (existing.alerts?.id) {
    await tx.driverAlertPreference.update({
      where: { driverId },
      data: alertData,
    });
  } else {
    await tx.driverAlertPreference.create({
      data: {
        driver: { connect: { id: driverId } },
        enabled: body.alerts.enabled ?? true,
        emailEnabled: body.alerts.emailEnabled ?? true,
        smsEnabled: body.alerts.smsEnabled ?? false,
      },
    });
  }
}
      if (body.location) {
        const locationData = {
          ...(body.location.homeBaseLat !== undefined
            ? { homeBaseLat: body.location.homeBaseLat }
            : {}),
          ...(body.location.homeBaseLng !== undefined
            ? { homeBaseLng: body.location.homeBaseLng }
            : {}),
          ...(body.location.homeBaseCity !== undefined
            ? { homeBaseCity: this.trimOptionalString(body.location.homeBaseCity) }
            : {}),
          ...(body.location.homeBaseState !== undefined
            ? { homeBaseState: this.trimOptionalString(body.location.homeBaseState) }
            : {}),
        };

        if (existing.location?.id) {
          await tx.driverLocation.update({
            where: { driverId },
            data: locationData,
          });
        } else {
          await tx.driverLocation.create({
            data: {
              driver: { connect: { id: driverId } },
              ...locationData,
            },
          });
        }
      }

      if (body.serviceDistrictIds) {
        const districtIds = Array.from(
          new Set(
            body.serviceDistrictIds
              .map((id) => id?.trim())
              .filter((id): id is string => !!id)
          )
        );

        if (districtIds.length > 0) {
          const foundDistricts = await tx.serviceDistrict.findMany({
            where: {
              id: { in: districtIds },
              active: true,
            },
            select: { id: true },
          });

          const foundIds = new Set(foundDistricts.map((x) => x.id));
          const missingIds = districtIds.filter((id) => !foundIds.has(id));

          if (missingIds.length > 0) {
            throw new BadRequestException(
              `Invalid or inactive serviceDistrictIds: ${missingIds.join(", ")}`
            );
          }
        }

        await tx.driverDistrictPreference.deleteMany({
          where: { driverId },
        });

        if (districtIds.length > 0) {
          await tx.driverDistrictPreference.createMany({
            data: districtIds.map((districtId) => ({
              driverId,
              districtId,
            })),
          });
        }
      }
    });

    return this.domain.findUnique({ id: driverId });
  } 
 async getPendingDrivers(): Promise<any[]> {
  return this.domain.findMany({
    where: {
      status: EnumDriverStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });
}

async approveDriver(input: {
  driverId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.driverApprovalEngine.approveDriver({
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.domain.findUnique({ id: input.driverId });
}

async suspendDriver(input: {
  driverId: string;
  actorUserId?: string | null;
  reason: string;
}): Promise<any> {
  await this.driverApprovalEngine.suspendDriver({
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason,
  });

  return this.domain.findUnique({ id: input.driverId });
}

async unsuspendDriver(input: {
  driverId: string;
  actorUserId?: string | null;
  note?: string | null;
}): Promise<any> {
  await this.driverApprovalEngine.unsuspendDriver({
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    note: input.note ?? null,
  });

  return this.domain.findUnique({ id: input.driverId });
}

async rejectDriver(input: {
  driverId: string;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<any> {
  await this.driverApprovalEngine.rejectDriver({
    driverId: input.driverId,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason?? null,  
});

  return this.domain.findUnique({ id: input.driverId });
}
async driverLookupList(): Promise<
  { id: string; name: string | null; status: EnumDriverStatus }[]
> {
  const rows = await this.prisma.driver.findMany({
    where: {
      status: EnumDriverStatus.APPROVED,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.user?.fullName ?? null,
    status: row.status,
  }));
}

async completeOnboarding(
  driverId: string,
  dto: CompleteDriverOnboardingDto
): Promise<any> {
  const driver = await this.prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      userId: true,
      status: true,
      onboardingCompletedAt: true,
    },
  });

  if (!driver) {
    throw new BadRequestException("Driver not found");
  }

  if (driver.status !== EnumDriverStatus.APPROVED) {
    throw new BadRequestException(
      "Onboarding can only be completed for approved drivers"
    );
  }

  if (driver.onboardingCompletedAt) {
    throw new BadRequestException("Onboarding has already been completed");
  }

  // Parse date of birth from MM/DD/YYYY to Date
  const [month, day, year] = dto.dateOfBirth.split("/");
  const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Store only the last 4 digits of SSN
  const ssnLastFour = dto.ssn.slice(-4);

  // Update driver record with onboarding data
  // fullName is stored on the related User model, not on Driver
  await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id: driver.userId },
      data: {
        fullName: dto.legalFullName.trim(),
      },
    }),
    this.prisma.driver.update({
      where: { id: driverId },
      data: {
        dateOfBirth: dob,
        ssnLastFour,
        residentialAddressLine1: dto.residentialAddressLine1.trim(),
        residentialAddressLine2: dto.residentialAddressLine2
          ? dto.residentialAddressLine2.trim()
          : null,
        residentialCity: dto.residentialCity.trim(),
        residentialState: dto.residentialState.trim(),
        residentialZip: dto.residentialZip.trim(),
        selfiePhotoUrl: dto.selfiePhotoUrl.trim(),
        onboardingCompletedAt: new Date(),
      },
    }),
  ]);

  return this.domain.findUnique({ id: driverId });
}

/**
 * Public (no-auth) onboarding methods using onboarding token from email link.
 */

async findDriverByOnboardingToken(token: string): Promise<any | null> {
  return this.prisma.driver.findFirst({
    where: { onboardingToken: token },
    select: {
      id: true,
      userId: true,
      status: true,
      onboardingCompletedAt: true,
      user: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });
}

async completeOnboardingByToken(
  token: string,
  dto: CompleteDriverOnboardingDto
): Promise<any> {
  const driver = await this.prisma.driver.findFirst({
    where: { onboardingToken: token },
    select: {
      id: true,
      userId: true,
      status: true,
      onboardingCompletedAt: true,
    },
  });

  if (!driver) {
    throw new NotFoundException("Invalid or expired token");
  }

  if (driver.status !== EnumDriverStatus.APPROVED) {
    throw new BadRequestException(
      "Onboarding can only be completed for approved drivers"
    );
  }

  if (driver.onboardingCompletedAt) {
    throw new BadRequestException("Onboarding has already been completed");
  }

  // Parse date of birth from MM/DD/YYYY to Date
  const [month, day, year] = dto.dateOfBirth.split("/");
  const dob = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Store only the last 4 digits of SSN
  const ssnLastFour = dto.ssn.slice(-4);

  // Update driver record with onboarding data
  // fullName is stored on the related User model, not on Driver
  await this.prisma.$transaction([
    this.prisma.user.update({
      where: { id: driver.userId },
      data: {
        fullName: dto.legalFullName.trim(),
      },
    }),
    this.prisma.driver.update({
      where: { id: driver.id },
      data: {
        dateOfBirth: dob,
        ssnLastFour,
        residentialAddressLine1: dto.residentialAddressLine1.trim(),
        residentialAddressLine2: dto.residentialAddressLine2
          ? dto.residentialAddressLine2.trim()
          : null,
        residentialCity: dto.residentialCity.trim(),
        residentialState: dto.residentialState.trim(),
        residentialZip: dto.residentialZip.trim(),
        selfiePhotoUrl: dto.selfiePhotoUrl.trim(),
        onboardingCompletedAt: new Date(),
      },
    }),
  ]);

  return this.domain.findUnique({ id: driver.id });
}

async getDriverDeliveriesByStatus(input: {
  driverId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ deliveries: any[]; total: number }> {
  const driverId = input.driverId;
  const status = input.status?.toUpperCase();
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  // Validate status if provided
  const validStatuses = [
    "DRAFT", "QUOTED", "LISTED", "BOOKED", "ACTIVE",
    "COMPLETED", "CANCELLED", "EXPIRED", "DISPUTED",
  ];

  if (status && !validStatuses.includes(status)) {
    throw new BadRequestException(
      `Invalid status. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  const where: Prisma.DeliveryAssignmentWhereInput = {
    driverId,
    unassignedAt: null,
    delivery: {
      ...(status ? { status: status as any } : {}),
    },
  };

  const [assignments, total] = await this.prisma.$transaction([
    this.prisma.deliveryAssignment.findMany({
      where,
      select: {
        assignedAt: true,
        delivery: {
          select: {
            id: true,
            status: true,
            serviceType: true,
            pickupAddress: true,
            pickupState: true,
            pickupLat: true,
            pickupLng: true,
            dropoffAddress: true,
            dropoffState: true,
            dropoffLat: true,
            dropoffLng: true,
            pickupWindowStart: true,
            pickupWindowEnd: true,
            dropoffWindowStart: true,
            dropoffWindowEnd: true,
            isUrgent: true,
            afterHours: true,
            createdAt: true,
            updatedAt: true,
            vehicleMake: true,
            vehicleModel: true,
            vehicleColor: true,
            licensePlate: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      skip,
      take: pageSize,
    }),
    this.prisma.deliveryAssignment.count({ where }),
  ]);

  return {
    deliveries: assignments.map((a) => ({
      ...a.delivery,
      assignedAt: a.assignedAt,
    })),
    total,
  };
}

}
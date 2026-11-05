import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverService } from "./driver.service";
import { DriverControllerBase } from "./base/driver.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { CompleteDriverOnboardingDto } from "./dto/driverOnboardingComplete.dto";
import { UpdateDriverOnboardingDto } from "./dto/driverOnboardingUpdate.dto";
import { MobileOnlyDriverGuard } from "../auth/guards/mobile-only-driver.guard";
import { PrismaService } from "../prisma/prisma.service";
import { DriverCreateInput } from "./base/DriverCreateInput";
import { Driver } from "./base/Driver";
import { DriverFindManyArgs } from "./base/DriverFindManyArgs";
import { DriverWhereUniqueInput } from "./base/DriverWhereUniqueInput";
import { DriverUpdateInput } from "./base/DriverUpdateInput";
import { DeliveryAssignmentFindManyArgs } from "../deliveryAssignment/base/DeliveryAssignmentFindManyArgs";
import { DeliveryAssignment } from "../deliveryAssignment/base/DeliveryAssignment";
import { DeliveryAssignmentWhereUniqueInput } from "../deliveryAssignment/base/DeliveryAssignmentWhereUniqueInput";
import { AdminAuditLogFindManyArgs } from "../adminAuditLog/base/AdminAuditLogFindManyArgs";
import { AdminAuditLog } from "../adminAuditLog/base/AdminAuditLog";
import { AdminAuditLogWhereUniqueInput } from "../adminAuditLog/base/AdminAuditLogWhereUniqueInput";
import { DriverDistrictPreferenceFindManyArgs } from "../driverDistrictPreference/base/DriverDistrictPreferenceFindManyArgs";
import { DriverDistrictPreference } from "../driverDistrictPreference/base/DriverDistrictPreference";
import { DriverDistrictPreferenceWhereUniqueInput } from "../driverDistrictPreference/base/DriverDistrictPreferenceWhereUniqueInput";
import { NotificationEventFindManyArgs } from "../notificationEvent/base/NotificationEventFindManyArgs";
import { NotificationEvent } from "../notificationEvent/base/NotificationEvent";
import { NotificationEventWhereUniqueInput } from "../notificationEvent/base/NotificationEventWhereUniqueInput";
import { DriverPayoutFindManyArgs } from "../driverPayout/base/DriverPayoutFindManyArgs";
import { DriverPayout } from "../driverPayout/base/DriverPayout";
import { DriverPayoutWhereUniqueInput } from "../driverPayout/base/DriverPayoutWhereUniqueInput";
import { DeliveryRatingFindManyArgs } from "../deliveryRating/base/DeliveryRatingFindManyArgs";
import { DeliveryRating } from "../deliveryRating/base/DeliveryRating";
import { DeliveryRatingWhereUniqueInput } from "../deliveryRating/base/DeliveryRatingWhereUniqueInput";
import { UpdateDriverProfileBody } from "./dto/driverProfile.dto";
import {
  ApproveDriverBody,
  SuspendDriverBody,
  UnsuspendDriverBody,
  RejectDriverBody
} from "./dto/driverApproval.dto";

@swagger.ApiTags("drivers")
@common.Controller("drivers")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DriverController extends DriverControllerBase {
  constructor(
    protected readonly service: DriverService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder,
    private readonly prisma: PrismaService
  ) {
    super(service, rolesBuilder);
  }

  // request.user carries ONLY { id, username, roles, isSuperAdmin } —
  // JwtStrategyBase.validate() rebuilds the user from the DB on every
  // request and never includes profileId, so reading request.user.profileId
  // here 403'd every driver. Resolve the driver row from the authenticated
  // userId instead (same contract as DriverPayoutController.resolveDriverId).
  private async resolveDriverProfileId(request: Request): Promise<string> {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new common.UnauthorizedException("Not authenticated");
    }
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!driver) {
      throw new common.ForbiddenException("Driver profile not found");
    }
    return driver.id;
  }
  // ── Driver self-service onboarding routes ──────────────────────────────
  // These routes MUST be declared BEFORE the base-style catch-alls below
  // (driver -> GET /:id, updateDriver -> PATCH /:id). NestJS scans controller
  // methods in DECLARATION order and Express matches in registration order,
  // so a GET/PATCH /onboarding-data declared after those catch-alls is
  // swallowed by them and answers 404
  // `No resource was found for {"id":"onboarding-data"}`.
  @common.Post("/onboarding-complete")
  // Driver onboarding is PHONE/TABLET ONLY — the driver-portal device gate
  // (stricter than the public signup gate: the touch hint is REQUIRED and
  // Chrome's own client hints must agree with the UA, so a UA-switcher
  // extension or a scripted replay is caught; runs after DefaultAuthGuard,
  // so the identity is already resolved).
  @common.UseGuards(MobileOnlyDriverGuard)
  @swagger.ApiOkResponse({ description: "Onboarding completed successfully" })
  @swagger.ApiBadRequestResponse({ description: "Invalid input or driver not eligible" })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "own",
  })
  async completeOnboarding(
    @common.Req() request: Request,
    @common.Body() body: CompleteDriverOnboardingDto
  ) {
    const profileId = await this.resolveDriverProfileId(request);

    try {
      return await this.service.completeOnboarding(profileId, body);
    } catch (error) {
      if (error instanceof common.BadRequestException) {
        throw error;
      }
      throw new common.NotFoundException(
        `Failed to complete onboarding: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  @common.Get("/onboarding-status")
  // PHONE/TABLET ONLY — same driver-portal device gate as the rest of the
  // self-service onboarding surface.
  @common.UseGuards(MobileOnlyDriverGuard)
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        onboardingCompleted: { type: "boolean" },
        onboardingCompletedAt: { type: "string", nullable: true },
        driverStatus: { type: "string" },
        residentialZip: { type: "string", nullable: true },
      },
    },
  })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "own",
  })
  async getOnboardingStatus(
    @common.Req() request: Request
  ): Promise<{
    onboardingCompleted: boolean;
    onboardingCompletedAt: string | null;
    driverStatus: string;
    dateOfBirth: string | null;
    residentialZip: string | null;
  }> {
    let profileId: string;
    try {
      profileId = await this.resolveDriverProfileId(request);
    } catch {
      // No authenticated user / no driver row — same graceful default the
      // missing-profileId branch used to return.
      return { onboardingCompleted: false, onboardingCompletedAt: null, driverStatus: "UNKNOWN", dateOfBirth: null, residentialZip: null };
    }

    const driver = await this.service.driver({
      where: { id: profileId },
      select: {
        status: true,
        onboardingCompletedAt: true,
        dateOfBirth: true,
        // Signup already collects (and stores) a 5-digit home ZIP; exposing
        // it here lets the onboarding form reuse it instead of asking again.
        residentialZip: true,
      },
    });

    return {
      onboardingCompleted: !!driver?.onboardingCompletedAt,
      onboardingCompletedAt: driver?.onboardingCompletedAt?.toISOString() ?? null,
      driverStatus: driver?.status ?? "UNKNOWN",
      dateOfBirth: driver?.dateOfBirth?.toISOString() ?? null,
      residentialZip: driver?.residentialZip ?? null,
    };
  }

  // ── Driver license update (self-service) ───────────────────────────────
  // Prefill + update for the Application Status board "Update Driver's
  // License" page, reachable ONLY while the driver is PENDING_APPROVAL
  // (owner decision: the background check starts after approval, so license
  // documents can never change underneath a running check — every other
  // status goes through support). GET returns the stored license number,
  // issuing state and photo URLs plus an `editable` flag so the page can
  // render an honest not-available card. PATCH re-validates identity
  // uniqueness (excluding the driver's own row) and never touches the
  // driver's status or onboardingCompletedAt. The PATCH keeps the same
  // PHONE/TABLET-ONLY gate as onboarding-complete — re-capturing license
  // photos requires the live camera, and desktops are refused on both
  // layers by design.

  @common.Get("/onboarding-data")
  // PHONE/TABLET ONLY — the prefill used to leak on desktops because only
  // the PATCH side was gated; the device gate now covers both halves of
  // the flow (the FE device.ts attaches the touch hint to this GET too).
  @common.UseGuards(MobileOnlyDriverGuard)
  @swagger.ApiOkResponse({
    description: "The driver's stored license data for prefill",
    schema: {
      type: "object",
      properties: {
        driverStatus: { type: "string" },
        onboardingCompleted: { type: "boolean" },
        editable: { type: "boolean" },
        licenseNumber: { type: "string", nullable: true },
        licenseState: { type: "string", nullable: true },
        licenseFrontUrl: { type: "string", nullable: true },
        licenseBackUrl: { type: "string", nullable: true },
      },
    },
  })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "own",
  })
  async getOnboardingData(@common.Req() request: Request) {
    const profileId = await this.resolveDriverProfileId(request);
    return this.service.getOnboardingData(profileId);
  }

  @common.Patch("/onboarding-data")
  @common.UseGuards(MobileOnlyDriverGuard)
  @swagger.ApiOkResponse({ description: "Driver license information updated" })
  @swagger.ApiBadRequestResponse({
    description: "Invalid input or the license is not editable for this status",
  })
  @swagger.ApiConflictResponse({
    description: "License already registered on another account",
  })
  @swagger.ApiForbiddenResponse({ description: "Driver profile not found" })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "own",
  })
  async updateOnboardingData(
    @common.Req() request: Request,
    @common.Body() body: UpdateDriverOnboardingDto
  ) {
    const profileId = await this.resolveDriverProfileId(request);

    try {
      return await this.service.updateOnboardingData(profileId, body);
    } catch (error) {
      if (
        error instanceof common.BadRequestException ||
        error instanceof common.ConflictException
      ) {
        throw error;
      }
      throw new common.NotFoundException(
        `Failed to update onboarding data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

@common.Get("/lookup/minimal")
@swagger.ApiOkResponse({
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string", nullable: true },
        status: { type: "string" },
      },
    },
  },
})
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "read",
  possession: "any",
})
async driverLookupMinimal(): Promise<
  { id: string; name: string | null; status: string }[]
> {
  return this.service.driverLookupList();
}  
 @common.Get("/admin/waitlisted")
@swagger.ApiOkResponse({ type: [Driver] })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "read",
  possession: "any",
})
async waitlistedDrivers(): Promise<Driver[]> {
  return this.service.getWaitlistedDrivers();
}

@common.Get("/admin/pending-approval")
@swagger.ApiOkResponse({ type: [Driver] })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "read",
  possession: "any",
})
async pendingApprovalDrivers(): Promise<Driver[]> {
  return this.service.getPendingApprovalDrivers();
}

@common.Post("/:id/invite")
@swagger.ApiOkResponse({ type: Driver })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "update",
  possession: "any",
})
async inviteDriver(
  @common.Param("id") id: string,
  @common.Body() body: ApproveDriverBody
): Promise<Driver | null> {
  return this.service.inviteDriver({
    driverId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post("/:id/approve")
@swagger.ApiOkResponse({ type: Driver })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "update",
  possession: "any",
})
async approveDriver(
  @common.Param("id") id: string,
  @common.Body() body: ApproveDriverBody
): Promise<Driver | null> {
  return this.service.approveDriver({
    driverId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}

@common.Post("/:id/suspend")
@swagger.ApiOkResponse({ type: Driver })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "update",
  possession: "any",
})
async suspendDriver(
  @common.Param("id") id: string,
  @common.Body() body: SuspendDriverBody
): Promise<Driver | null> {
  return this.service.suspendDriver({
    driverId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason,
  });
}

@common.Post("/:id/unsuspend")
@swagger.ApiOkResponse({ type: Driver })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "update",
  possession: "any",
})
async unsuspendDriver(
  @common.Param("id") id: string,
  @common.Body() body: UnsuspendDriverBody
): Promise<Driver | null> {
  return this.service.unsuspendDriver({
    driverId: id,
    actorUserId: body.actorUserId ?? null,
    note: body.note ?? null,
  });
}


@common.Post("/:id/reject")
@swagger.ApiOkResponse({ type: Driver })
@nestAccessControl.UseRoles({
  resource: "Driver",
  action: "update",
  possession: "any",
})
async rejectDriver(
  @common.Param("id") id: string,
  @common.Body() body: RejectDriverBody
): Promise<Driver | null> {
  return this.service.rejectDriver({
    driverId: id,
    actorUserId: body.actorUserId ?? null,
    reason: body.reason ?? null,
  });
}

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id/profile")
  @swagger.ApiOkResponse({ type: Driver })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateProfile(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: UpdateDriverProfileBody
  ): Promise<Driver | null> {
    try {
      return await this.service.updateDriverProfile(params.id, body);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }


@common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: Driver })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDriver(@common.Body() data: DriverCreateInput): Promise<Driver> {
    return await this.service.createDriver({
      data: {
        ...data,

        alerts: data.alerts
          ? {
              connect: data.alerts,
            }
          : undefined,

        approvedBy: data.approvedBy
          ? {
              connect: data.approvedBy,
            }
          : undefined,

        location: data.location
          ? {
              connect: data.location,
            }
          : undefined,

        preferences: data.preferences
          ? {
              connect: data.preferences,
            }
          : undefined,

        user: {
          connect: data.user,
        },
      },
      select: {
        alerts: {
          select: {
            id: true,
          },
        },

        approvedAt: true,

        approvedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,
        id: true,

        location: {
          select: {
            id: true,
          },
        },

        phone: true,

        preferences: {
          select: {
            id: true,
          },
        },

        profilePhotoUrl: true,
        status: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [Driver] })
  @ApiNestedQuery(DriverFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async drivers(@common.Req() request: Request): Promise<Driver[]> {
    const args = plainToClass(DriverFindManyArgs, request.query);
    return this.service.drivers({
      ...args,
      select: {
        alerts: {
          select: {
            id: true,
          },
        },

        approvedAt: true,

        approvedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,
        id: true,

        location: {
          select: {
            id: true,
          },
        },

        phone: true,

        preferences: {
          select: {
            id: true,
          },
        },

        profilePhotoUrl: true,
        status: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: Driver })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async driver(
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<Driver | null> {
    const result = await this.service.driver({
      where: params,
      select: {
        alerts: {
          select: {
            id: true,
            enabled: true,
            emailEnabled: true,
            smsEnabled: true,
          },
        },

        approvedAt: true,

        approvedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,
        id: true,

        location: {
          select: {
            id: true,
            homeBaseLat: true,
            homeBaseLng: true,
            homeBaseCity: true,
            homeBaseState: true,
          },
        },

        phone: true,

        // Primary/home ZIP — captured at signup, authoritative (admin
        // shows it; the service-area badge derives from it). Exposed so
        // the driver preferences page prefills the Primary ZIP field with
        // the registration value instead of an empty/legacy one.
        residentialZip: true,

        preferences: {
          select: {
            id: true,
            city: true,
            radiusMiles: true,
          },
        },

        profilePhotoUrl: true,
        selfiePhotoUrl: true,
        status: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },

        districts: {
          select: {
            id: true,
            districtId: true,
            district: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });
    if (result === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return result;
  }

  @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Patch("/:id")
  @swagger.ApiOkResponse({ type: Driver })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDriver(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() data: DriverUpdateInput
  ): Promise<Driver | null> {
    try {
      return await this.service.updateDriver({
        where: params,
        data: {
          ...data,

          alerts: data.alerts
            ? {
                connect: data.alerts,
              }
            : undefined,

          approvedBy: data.approvedBy
            ? {
                connect: data.approvedBy,
              }
            : undefined,

          location: data.location
            ? {
                connect: data.location,
              }
            : undefined,

          preferences: data.preferences
            ? {
                connect: data.preferences,
              }
            : undefined,

          user: {
            connect: data.user,
          },
        },
        select: {
          alerts: {
            select: {
              id: true,
            },
          },

          approvedAt: true,

          approvedBy: {
            select: {
              id: true,
            },
          },

          createdAt: true,
          id: true,

          location: {
            select: {
              id: true,
            },
          },

          phone: true,

          preferences: {
            select: {
              id: true,
            },
          },

          profilePhotoUrl: true,
          status: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
            },
          },
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @common.Delete("/:id")
  @swagger.ApiOkResponse({ type: Driver })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDriver(
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<Driver | null> {
    try {
      return await this.service.deleteDriver({
        where: params,
        select: {
          alerts: {
            select: {
              id: true,
            },
          },

          approvedAt: true,

          approvedBy: {
            select: {
              id: true,
            },
          },

          createdAt: true,
          id: true,

          location: {
            select: {
              id: true,
            },
          },

          phone: true,

          preferences: {
            select: {
              id: true,
            },
          },

          profilePhotoUrl: true,
          status: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
            },
          },
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/assignments")
  @ApiNestedQuery(DeliveryAssignmentFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryAssignment",
    action: "read",
    possession: "any",
  })
  async findAssignments(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<DeliveryAssignment[]> {
    const query = plainToClass(DeliveryAssignmentFindManyArgs, request.query);
    const results = await this.service.findAssignments(params.id, {
      ...query,
      select: {
        assignedAt: true,

        assignedBy: {
          select: {
            id: true,
          },
        },

        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        unassignedAt: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectAssignments(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updateAssignments(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/assignments")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectAssignments(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryAssignmentWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      assignments: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/audits")
  @ApiNestedQuery(AdminAuditLogFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AdminAuditLog",
    action: "read",
    possession: "any",
  })
  async findAudits(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<AdminAuditLog[]> {
    const query = plainToClass(AdminAuditLogFindManyArgs, request.query);
    const results = await this.service.findAudits(params.id, {
      ...query,
      select: {
        action: true,

        actor: {
          select: {
            id: true,
          },
        },

        actorType: true,
        afterJson: true,
        beforeJson: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        reason: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
          },
        },
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectAudits(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updateAudits(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/audits")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectAudits(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: AdminAuditLogWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      audits: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/districts")
  @ApiNestedQuery(DriverDistrictPreferenceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DriverDistrictPreference",
    action: "read",
    possession: "any",
  })
  async findDistricts(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<DriverDistrictPreference[]> {
    const query = plainToClass(
      DriverDistrictPreferenceFindManyArgs,
      request.query
    );
    const results = await this.service.findDistricts(params.id, {
      ...query,
      select: {
        createdAt: true,

        district: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/districts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectDistricts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      districts: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/districts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updateDistricts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      districts: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/districts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectDistricts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      districts: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

@common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/deliveries")
  @swagger.ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        deliveries: { type: "array", items: { type: "object" } },
        total: { type: "number" },
      },
    },
  })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async getDriverDeliveries(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Query("status") status?: string,
    @common.Query("page") page?: string,
    @common.Query("pageSize") pageSize?: string,
  ): Promise<{ deliveries: any[]; total: number }> {
    try {
      return await this.service.getDriverDeliveriesByStatus({
        driverId: params.id,
        status: status ?? undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new errors.NotFoundException(
          `No resource was found for ${JSON.stringify(params)}`
        );
      }
      throw error;
    }
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/notifications")
  @ApiNestedQuery(NotificationEventFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "NotificationEvent",
    action: "read",
    possession: "any",
  })
  async findNotifications(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<NotificationEvent[]> {
    const query = plainToClass(NotificationEventFindManyArgs, request.query);
    const results = await this.service.findNotifications(params.id, {
      ...query,
      select: {
        actor: {
          select: {
            id: true,
          },
        },

        body: true,
        channel: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        errorMessage: true,
        failedAt: true,
        id: true,
        payload: true,
        sentAt: true,
        status: true,
        subject: true,
        templateCode: true,
        toEmail: true,
        toPhone: true,
        type: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectNotifications(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updateNotifications(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/notifications")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectNotifications(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: NotificationEventWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      notifications: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/payouts")
  @ApiNestedQuery(DriverPayoutFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DriverPayout",
    action: "read",
    possession: "any",
  })
  async findPayouts(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<DriverPayout[]> {
    const query = plainToClass(DriverPayoutFindManyArgs, request.query);
    const results = await this.service.findPayouts(params.id, {
      ...query,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        driverSharePct: true,
        failedAt: true,
        failureMessage: true,
        grossAmount: true,
        id: true,
        insuranceFee: true,
        netAmount: true,
        paidAt: true,
        platformFee: true,
        providerTransferId: true,
        status: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/payouts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectPayouts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverPayoutWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      payouts: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/payouts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updatePayouts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverPayoutWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      payouts: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/payouts")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectPayouts(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DriverPayoutWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      payouts: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/ratingsReceived")
  @ApiNestedQuery(DeliveryRatingFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryRating",
    action: "read",
    possession: "any",
  })
  async findRatingsReceived(
    @common.Req() request: Request,
    @common.Param() params: DriverWhereUniqueInput
  ): Promise<DeliveryRating[]> {
    const query = plainToClass(DeliveryRatingFindManyArgs, request.query);
    const results = await this.service.findRatingsReceived(params.id, {
      ...query,
      select: {
        comment: true,
        createdAt: true,

        customer: {
          select: {
            id: true,
          },
        },

        delivery: {
          select: {
            id: true,
          },
        },

        driver: {
          select: {
            id: true,
          },
        },

        id: true,
        stars: true,
        target: true,
        updatedAt: true,
      },
    });
    if (results === null) {
      throw new errors.NotFoundException(
        `No resource was found for ${JSON.stringify(params)}`
      );
    }
    return results;
  }

  @common.Post("/:id/ratingsReceived")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async connectRatingsReceived(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryRatingWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      ratingsReceived: {
        connect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/ratingsReceived")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async updateRatingsReceived(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryRatingWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      ratingsReceived: {
        set: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/ratingsReceived")
  @nestAccessControl.UseRoles({
    resource: "Driver",
    action: "update",
    possession: "any",
  })
  async disconnectRatingsReceived(
    @common.Param() params: DriverWhereUniqueInput,
    @common.Body() body: DeliveryRatingWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      ratingsReceived: {
        disconnect: body,
      },
    };
    await this.service.updateDriver({
      where: params,
      data,
      select: { id: true },
    });
  }
}

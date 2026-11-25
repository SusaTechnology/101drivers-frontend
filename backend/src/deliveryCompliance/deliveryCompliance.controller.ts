import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DeliveryComplianceService } from "./deliveryCompliance.service";
import { DeliveryComplianceControllerBase } from "./base/deliveryCompliance.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { DeliveryComplianceCreateInput } from "./base/DeliveryComplianceCreateInput";
import { DeliveryCompliance } from "./base/DeliveryCompliance";
import { DeliveryComplianceFindManyArgs } from "./base/DeliveryComplianceFindManyArgs";
import { DeliveryComplianceWhereUniqueInput } from "./base/DeliveryComplianceWhereUniqueInput";
import { DeliveryComplianceUpdateInput } from "./base/DeliveryComplianceUpdateInput";
import { PrismaService } from "../prisma/prisma.service";
import { EnumDriverStatus, EnumUserRoles } from "@prisma/client";
@swagger.ApiTags("deliveryCompliances")
@common.Controller("deliveryCompliances")

@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DeliveryComplianceController extends DeliveryComplianceControllerBase {
  constructor(
    protected readonly service: DeliveryComplianceService,
    private readonly prisma: PrismaService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  /**
   * Participant-or-admin gate for delivery-attached record creation —
   * same contract as the deliveryEvidence controller (owning customer,
   * currently-ASSIGNED driver, or admin; DRIVER actors must be APPROVED).
   */
  private async assertDeliveryParticipantOrAdmin(
    deliveryId: string,
    request?: Request
  ): Promise<void> {
    const user = (request as any).user;
    if (!user?.id) {
      throw new common.UnauthorizedException("Not authenticated");
    }
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (roles.includes(EnumUserRoles.ADMIN)) return;

    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryId },
      select: {
        customerId: true,
        assignments: {
          where: { unassignedAt: null },
          select: { driverId: true },
        },
      },
    });
    if (!delivery) {
      throw new errors.NotFoundException(
        `No resource was found for delivery ${deliveryId}`
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (customer && delivery.customerId === customer.id) return;

    const driver = await this.prisma.driver.findFirst({
      where: { userId: user.id },
      select: { id: true, status: true },
    });
    if (driver && delivery.assignments.some((a) => a.driverId === driver.id)) {
      if (driver.status !== EnumDriverStatus.APPROVED) {
        throw new common.ForbiddenException(
          `Driver account is not approved (current status: ${driver.status})`
        );
      }
      return;
    }

    throw new errors.NotFoundException(
      `No resource was found for delivery ${deliveryId}`
    );
  }
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: DeliveryCompliance })
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDeliveryCompliance(
    @common.Body() data: DeliveryComplianceCreateInput,
    @common.Req() request?: Request
  ): Promise<DeliveryCompliance> {
    // Ownership: the delivery id comes from the body, so it must be
    // validated against the session before any row is written.
    const deliveryId = (data as any)?.delivery?.connect?.id;
    if (typeof deliveryId === "string" && deliveryId) {
      await this.assertDeliveryParticipantOrAdmin(deliveryId, request);
    }
    // Verification identity must come from the session, never the body:
    // only admins may set verifiedBy — a driver connecting themselves (or
    // anyone else) as the verifier would fabricate a compliance approval.
    const isAdmin = Array.isArray((request as any).user?.roles)
      ? (request as any).user.roles.includes(EnumUserRoles.ADMIN)
      : false;
    return await this.service.createDeliveryCompliance({
      data: {
        ...data,

        delivery: {
          connect: data.delivery,
        },

        verifiedBy:
          isAdmin && data.verifiedBy
            ? {
                connect: data.verifiedBy,
              }
            : undefined,
      },
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        dropoffCompletedAt: true,
        id: true,
        odometerEnd: true,
        odometerStart: true,
        pickupCompletedAt: true,
        updatedAt: true,

        verifiedBy: {
          select: {
            id: true,
          },
        },

        verifiedByAdminAt: true,
        vinConfirmed: true,
        vinVerificationCode: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [DeliveryCompliance] })
  @ApiNestedQuery(DeliveryComplianceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryCompliances(
    @common.Req() request: Request
  ): Promise<DeliveryCompliance[]> {
    const args = plainToClass(DeliveryComplianceFindManyArgs, request.query);
    return this.service.deliveryCompliances({
      ...args,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        dropoffCompletedAt: true,
        id: true,
        odometerEnd: true,
        odometerStart: true,
        pickupCompletedAt: true,
        updatedAt: true,

        verifiedBy: {
          select: {
            id: true,
          },
        },

        verifiedByAdminAt: true,
        vinConfirmed: true,
        vinVerificationCode: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: DeliveryCompliance })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deliveryCompliance(
    @common.Param() params: DeliveryComplianceWhereUniqueInput
  ): Promise<DeliveryCompliance | null> {
    const result = await this.service.deliveryCompliance({
      where: params,
      select: {
        createdAt: true,

        delivery: {
          select: {
            id: true,
          },
        },

        dropoffCompletedAt: true,
        id: true,
        odometerEnd: true,
        odometerStart: true,
        pickupCompletedAt: true,
        updatedAt: true,

        verifiedBy: {
          select: {
            id: true,
          },
        },

        verifiedByAdminAt: true,
        vinConfirmed: true,
        vinVerificationCode: true,
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
  @swagger.ApiOkResponse({ type: DeliveryCompliance })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDeliveryCompliance(
    @common.Param() params: DeliveryComplianceWhereUniqueInput,
    @common.Body() data: DeliveryComplianceUpdateInput
  ): Promise<DeliveryCompliance | null> {
    try {
      return await this.service.updateDeliveryCompliance({
        where: params,
        data: {
          ...data,

          delivery: {
            connect: data.delivery,
          },

          verifiedBy: data.verifiedBy
            ? {
                connect: data.verifiedBy,
              }
            : undefined,
        },
        select: {
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          dropoffCompletedAt: true,
          id: true,
          odometerEnd: true,
          odometerStart: true,
          pickupCompletedAt: true,
          updatedAt: true,

          verifiedBy: {
            select: {
              id: true,
            },
          },

          verifiedByAdminAt: true,
          vinConfirmed: true,
          vinVerificationCode: true,
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
  @swagger.ApiOkResponse({ type: DeliveryCompliance })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DeliveryCompliance",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDeliveryCompliance(
    @common.Param() params: DeliveryComplianceWhereUniqueInput
  ): Promise<DeliveryCompliance | null> {
    try {
      return await this.service.deleteDeliveryCompliance({
        where: params,
        select: {
          createdAt: true,

          delivery: {
            select: {
              id: true,
            },
          },

          dropoffCompletedAt: true,
          id: true,
          odometerEnd: true,
          odometerStart: true,
          pickupCompletedAt: true,
          updatedAt: true,

          verifiedBy: {
            select: {
              id: true,
            },
          },

          verifiedByAdminAt: true,
          vinConfirmed: true,
          vinVerificationCode: true,
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
}

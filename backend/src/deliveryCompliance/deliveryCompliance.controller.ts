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
@swagger.ApiTags("deliveryCompliances")
@common.Controller("deliveryCompliances")

@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DeliveryComplianceController extends DeliveryComplianceControllerBase {
  constructor(
    protected readonly service: DeliveryComplianceService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
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
    @common.Body() data: DeliveryComplianceCreateInput
  ): Promise<DeliveryCompliance> {
    return await this.service.createDeliveryCompliance({
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

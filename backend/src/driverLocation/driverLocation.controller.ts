import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { DriverLocationService } from "./driverLocation.service";
import { DriverLocationControllerBase } from "./base/driverLocation.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { DriverLocationCreateInput } from "./base/DriverLocationCreateInput";
import { DriverLocation } from "./base/DriverLocation";
import { DriverLocationFindManyArgs } from "./base/DriverLocationFindManyArgs";
import { DriverLocationWhereUniqueInput } from "./base/DriverLocationWhereUniqueInput";
import { DriverLocationUpdateInput } from "./base/DriverLocationUpdateInput";
@swagger.ApiTags("driverLocations")
@common.Controller("driverLocations")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class DriverLocationController extends DriverLocationControllerBase {
  constructor(
    protected readonly service: DriverLocationService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: DriverLocation })
  @nestAccessControl.UseRoles({
    resource: "DriverLocation",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createDriverLocation(
    @common.Body() data: DriverLocationCreateInput
  ): Promise<DriverLocation> {
    return await this.service.createDriverLocation({
      data: {
        ...data,

        driver: {
          connect: data.driver,
        },
      },
      select: {
        createdAt: true,
        currentAt: true,
        currentLat: true,
        currentLng: true,

        driver: {
          select: {
            id: true,
          },
        },

        homeBaseCity: true,
        homeBaseLat: true,
        homeBaseLng: true,
        homeBaseState: true,
        id: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [DriverLocation] })
  @ApiNestedQuery(DriverLocationFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DriverLocation",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async driverLocations(
    @common.Req() request: Request
  ): Promise<DriverLocation[]> {
    const args = plainToClass(DriverLocationFindManyArgs, request.query);
    return this.service.driverLocations({
      ...args,
      select: {
        createdAt: true,
        currentAt: true,
        currentLat: true,
        currentLng: true,

        driver: {
          select: {
            id: true,
          },
        },

        homeBaseCity: true,
        homeBaseLat: true,
        homeBaseLng: true,
        homeBaseState: true,
        id: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: DriverLocation })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DriverLocation",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async driverLocation(
    @common.Param() params: DriverLocationWhereUniqueInput
  ): Promise<DriverLocation | null> {
    const result = await this.service.driverLocation({
      where: params,
      select: {
        createdAt: true,
        currentAt: true,
        currentLat: true,
        currentLng: true,

        driver: {
          select: {
            id: true,
          },
        },

        homeBaseCity: true,
        homeBaseLat: true,
        homeBaseLng: true,
        homeBaseState: true,
        id: true,
        updatedAt: true,
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
  @swagger.ApiOkResponse({ type: DriverLocation })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DriverLocation",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateDriverLocation(
    @common.Param() params: DriverLocationWhereUniqueInput,
    @common.Body() data: DriverLocationUpdateInput
  ): Promise<DriverLocation | null> {
    try {
      return await this.service.updateDriverLocation({
        where: params,
        data: {
          ...data,

          driver: {
            connect: data.driver,
          },
        },
        select: {
          createdAt: true,
          currentAt: true,
          currentLat: true,
          currentLng: true,

          driver: {
            select: {
              id: true,
            },
          },

          homeBaseCity: true,
          homeBaseLat: true,
          homeBaseLng: true,
          homeBaseState: true,
          id: true,
          updatedAt: true,
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
  @swagger.ApiOkResponse({ type: DriverLocation })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "DriverLocation",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteDriverLocation(
    @common.Param() params: DriverLocationWhereUniqueInput
  ): Promise<DriverLocation | null> {
    try {
      return await this.service.deleteDriverLocation({
        where: params,
        select: {
          createdAt: true,
          currentAt: true,
          currentLat: true,
          currentLng: true,

          driver: {
            select: {
              id: true,
            },
          },

          homeBaseCity: true,
          homeBaseLat: true,
          homeBaseLng: true,
          homeBaseState: true,
          id: true,
          updatedAt: true,
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

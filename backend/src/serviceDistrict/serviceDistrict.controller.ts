import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { ServiceDistrictService } from "./serviceDistrict.service";
import { ServiceDistrictControllerBase } from "./base/serviceDistrict.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { ServiceDistrictCreateInput } from "./base/ServiceDistrictCreateInput";
import { ServiceDistrict } from "./base/ServiceDistrict";
import { ServiceDistrictFindManyArgs } from "./base/ServiceDistrictFindManyArgs";
import { ServiceDistrictWhereUniqueInput } from "./base/ServiceDistrictWhereUniqueInput";
import { ServiceDistrictUpdateInput } from "./base/ServiceDistrictUpdateInput";
import { DriverDistrictPreferenceFindManyArgs } from "../driverDistrictPreference/base/DriverDistrictPreferenceFindManyArgs";
import { DriverDistrictPreference } from "../driverDistrictPreference/base/DriverDistrictPreference";
import { DriverDistrictPreferenceWhereUniqueInput } from "../driverDistrictPreference/base/DriverDistrictPreferenceWhereUniqueInput";
@swagger.ApiTags("serviceDistricts")
@common.Controller("serviceDistricts")

@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class ServiceDistrictController extends ServiceDistrictControllerBase {
  constructor(
    protected readonly service: ServiceDistrictService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: ServiceDistrict })
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createServiceDistrict(
    @common.Body() data: ServiceDistrictCreateInput
  ): Promise<ServiceDistrict> {
    return await this.service.createServiceDistrict({
      data: data,
      select: {
        active: true,
        code: true,
        createdAt: true,
        geoJson: true,
        id: true,
        name: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [ServiceDistrict] })
  @ApiNestedQuery(ServiceDistrictFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async serviceDistricts(
    @common.Req() request: Request
  ): Promise<ServiceDistrict[]> {
    const args = plainToClass(ServiceDistrictFindManyArgs, request.query);
    return this.service.serviceDistricts({
      ...args,
      select: {
        active: true,
        code: true,
        createdAt: true,
        geoJson: true,
        id: true,
        name: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: ServiceDistrict })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async serviceDistrict(
    @common.Param() params: ServiceDistrictWhereUniqueInput
  ): Promise<ServiceDistrict | null> {
    const result = await this.service.serviceDistrict({
      where: params,
      select: {
        active: true,
        code: true,
        createdAt: true,
        geoJson: true,
        id: true,
        name: true,
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
  @swagger.ApiOkResponse({ type: ServiceDistrict })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateServiceDistrict(
    @common.Param() params: ServiceDistrictWhereUniqueInput,
    @common.Body() data: ServiceDistrictUpdateInput
  ): Promise<ServiceDistrict | null> {
    try {
      return await this.service.updateServiceDistrict({
        where: params,
        data: data,
        select: {
          active: true,
          code: true,
          createdAt: true,
          geoJson: true,
          id: true,
          name: true,
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
  @swagger.ApiOkResponse({ type: ServiceDistrict })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteServiceDistrict(
    @common.Param() params: ServiceDistrictWhereUniqueInput
  ): Promise<ServiceDistrict | null> {
    try {
      return await this.service.deleteServiceDistrict({
        where: params,
        select: {
          active: true,
          code: true,
          createdAt: true,
          geoJson: true,
          id: true,
          name: true,
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

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id/driverPrefs")
  @ApiNestedQuery(DriverDistrictPreferenceFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "DriverDistrictPreference",
    action: "read",
    possession: "any",
  })
  async findDriverPrefs(
    @common.Req() request: Request,
    @common.Param() params: ServiceDistrictWhereUniqueInput
  ): Promise<DriverDistrictPreference[]> {
    const query = plainToClass(
      DriverDistrictPreferenceFindManyArgs,
      request.query
    );
    const results = await this.service.findDriverPrefs(params.id, {
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

  @common.Post("/:id/driverPrefs")
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "update",
    possession: "any",
  })
  async connectDriverPrefs(
    @common.Param() params: ServiceDistrictWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driverPrefs: {
        connect: body,
      },
    };
    await this.service.updateServiceDistrict({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Patch("/:id/driverPrefs")
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "update",
    possession: "any",
  })
  async updateDriverPrefs(
    @common.Param() params: ServiceDistrictWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driverPrefs: {
        set: body,
      },
    };
    await this.service.updateServiceDistrict({
      where: params,
      data,
      select: { id: true },
    });
  }

  @common.Delete("/:id/driverPrefs")
  @nestAccessControl.UseRoles({
    resource: "ServiceDistrict",
    action: "update",
    possession: "any",
  })
  async disconnectDriverPrefs(
    @common.Param() params: ServiceDistrictWhereUniqueInput,
    @common.Body() body: DriverDistrictPreferenceWhereUniqueInput[]
  ): Promise<void> {
    const data = {
      driverPrefs: {
        disconnect: body,
      },
    };
    await this.service.updateServiceDistrict({
      where: params,
      data,
      select: { id: true },
    });
  }
}

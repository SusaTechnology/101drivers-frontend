import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { AppSettingService } from "./appSetting.service";
import { AppSettingControllerBase } from "./base/appSetting.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { AppSettingCreateInput } from "./base/AppSettingCreateInput";
import { AppSetting } from "./base/AppSetting";
import { AppSettingFindManyArgs } from "./base/AppSettingFindManyArgs";
import { AppSettingWhereUniqueInput } from "./base/AppSettingWhereUniqueInput";
import { AppSettingUpdateInput } from "./base/AppSettingUpdateInput";
import {
  LandingPageSettingsResponseDto,
  UpdateLandingPageSettingsBody,
  DeliverySettingsResponseDto,
  UpdateDeliverySettingsBody,
} from "./dto/appSetting.dto";

@swagger.ApiTags("appSettings")
@common.Controller("appSettings")
export class AppSettingController extends AppSettingControllerBase {
  constructor(
    protected readonly service: AppSettingService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  @common.Get("landing-page")
  @swagger.ApiOkResponse({ type: LandingPageSettingsResponseDto })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getLandingPageSettings(): Promise<LandingPageSettingsResponseDto> {
    return this.service.getLandingPageSettings();
  }

  @common.Patch("landing-page")
  @swagger.ApiOkResponse({ type: LandingPageSettingsResponseDto })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  async updateLandingPageSettings(
    @common.Body() body: UpdateLandingPageSettingsBody
  ): Promise<LandingPageSettingsResponseDto> {
    return this.service.updateLandingPageSettings(body);
  }

  @common.Get("delivery")
  @swagger.ApiOkResponse({ type: DeliverySettingsResponseDto })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  async getDeliverySettings(): Promise<DeliverySettingsResponseDto> {
    return this.service.getDeliverySettings();
  }

  @common.Patch("delivery")
  @swagger.ApiOkResponse({ type: DeliverySettingsResponseDto })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  async updateDeliverySettings(
    @common.Body() body: UpdateDeliverySettingsBody
  ): Promise<DeliverySettingsResponseDto> {
    return this.service.updateDeliverySettings(body);
  }

 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: AppSetting })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createAppSetting(
    @common.Body() data: AppSettingCreateInput
  ): Promise<AppSetting> {
    return await this.service.createAppSetting({
      data: data,
      select: {
        createdAt: true,
        id: true,
        key: true,
        updatedAt: true,
        value: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [AppSetting] })
  @ApiNestedQuery(AppSettingFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async appSettings(@common.Req() request: Request): Promise<AppSetting[]> {
    const args = plainToClass(AppSettingFindManyArgs, request.query);
    return this.service.appSettings({
      ...args,
      select: {
        createdAt: true,
        id: true,
        key: true,
        updatedAt: true,
        value: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: AppSetting })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async appSetting(
    @common.Param() params: AppSettingWhereUniqueInput
  ): Promise<AppSetting | null> {
    const result = await this.service.appSetting({
      where: params,
      select: {
        createdAt: true,
        id: true,
        key: true,
        updatedAt: true,
        value: true,
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
  @swagger.ApiOkResponse({ type: AppSetting })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateAppSetting(
    @common.Param() params: AppSettingWhereUniqueInput,
    @common.Body() data: AppSettingUpdateInput
  ): Promise<AppSetting | null> {
    try {
      return await this.service.updateAppSetting({
        where: params,
        data: data,
        select: {
          createdAt: true,
          id: true,
          key: true,
          updatedAt: true,
          value: true,
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
  @swagger.ApiOkResponse({ type: AppSetting })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "AppSetting",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteAppSetting(
    @common.Param() params: AppSettingWhereUniqueInput
  ): Promise<AppSetting | null> {
    try {
      return await this.service.deleteAppSetting({
        where: params,
        select: {
          createdAt: true,
          id: true,
          key: true,
          updatedAt: true,
          value: true,
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

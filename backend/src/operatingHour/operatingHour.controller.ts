import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { OperatingHourService } from "./operatingHour.service";
import { OperatingHourControllerBase } from "./base/operatingHour.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { OperatingHourCreateInput } from "./base/OperatingHourCreateInput";
import { OperatingHour } from "./base/OperatingHour";
import { OperatingHourFindManyArgs } from "./base/OperatingHourFindManyArgs";
import { OperatingHourWhereUniqueInput } from "./base/OperatingHourWhereUniqueInput";
import { OperatingHourUpdateInput } from "./base/OperatingHourUpdateInput";

import {
  OperatingHourActionDto,
  OperatingHourAdminListQueryDto,
  OperatingHourAdminUpsertBodyDto,
} from "./dto/operatingHourAdmin.dto";

@swagger.ApiTags("operatingHours")
@common.Controller("operatingHours")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class OperatingHourController extends OperatingHourControllerBase {
  constructor(
    protected readonly service: OperatingHourService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  @common.Get("admin")
  async adminList(@common.Query() query: OperatingHourAdminListQueryDto) {
    return this.service.getAdminOperatingHours(query);
  }

  @common.Get("admin/active")
  async adminActive() {
    return this.service.getActiveOperatingHours();
  }

  @common.Get("admin/weekly")
  async adminWeekly() {
    return this.service.getWeeklyOperatingHours();
  }

  @common.Post("admin/upsert")
  async adminUpsert(@common.Body() body: OperatingHourAdminUpsertBodyDto) {
    return this.service.upsertAdminOperatingHour(body);
  }

  @common.Post(":id/activate")
  async activate(
    @common.Param("id") id: string,
    @common.Body() body: OperatingHourActionDto
  ) {
    return this.service.activateOperatingHour({
      id,
      actorUserId: body.actorUserId ?? null,
    });
  }

  @common.Post(":id/deactivate")
  async deactivate(
    @common.Param("id") id: string,
    @common.Body() body: OperatingHourActionDto
  ) {
    return this.service.deactivateOperatingHour({
      id,
      actorUserId: body.actorUserId ?? null,
    });
  }
 @common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: OperatingHour })
  @nestAccessControl.UseRoles({
    resource: "OperatingHour",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createOperatingHour(
    @common.Body() data: OperatingHourCreateInput
  ): Promise<OperatingHour> {
    return await this.service.createOperatingHour({
      data: data,
      select: {
        active: true,
        createdAt: true,
        dayOfWeek: true,
        endTime: true,
        id: true,
        startTime: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [OperatingHour] })
  @ApiNestedQuery(OperatingHourFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "OperatingHour",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async operatingHours(
    @common.Req() request: Request
  ): Promise<OperatingHour[]> {
    const args = plainToClass(OperatingHourFindManyArgs, request.query);
    return this.service.operatingHours({
      ...args,
      select: {
        active: true,
        createdAt: true,
        dayOfWeek: true,
        endTime: true,
        id: true,
        startTime: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: OperatingHour })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "OperatingHour",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async operatingHour(
    @common.Param() params: OperatingHourWhereUniqueInput
  ): Promise<OperatingHour | null> {
    const result = await this.service.operatingHour({
      where: params,
      select: {
        active: true,
        createdAt: true,
        dayOfWeek: true,
        endTime: true,
        id: true,
        startTime: true,
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
  @swagger.ApiOkResponse({ type: OperatingHour })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "OperatingHour",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateOperatingHour(
    @common.Param() params: OperatingHourWhereUniqueInput,
    @common.Body() data: OperatingHourUpdateInput
  ): Promise<OperatingHour | null> {
    try {
      return await this.service.updateOperatingHour({
        where: params,
        data: data,
        select: {
          active: true,
          createdAt: true,
          dayOfWeek: true,
          endTime: true,
          id: true,
          startTime: true,
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
  @swagger.ApiOkResponse({ type: OperatingHour })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "OperatingHour",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteOperatingHour(
    @common.Param() params: OperatingHourWhereUniqueInput
  ): Promise<OperatingHour | null> {
    try {
      return await this.service.deleteOperatingHour({
        where: params,
        select: {
          active: true,
          createdAt: true,
          dayOfWeek: true,
          endTime: true,
          id: true,
          startTime: true,
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


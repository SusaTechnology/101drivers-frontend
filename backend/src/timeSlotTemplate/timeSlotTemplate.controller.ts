import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { TimeSlotTemplateService } from "./timeSlotTemplate.service";
import { TimeSlotTemplateControllerBase } from "./base/timeSlotTemplate.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { TimeSlotTemplateCreateInput } from "./base/TimeSlotTemplateCreateInput";
import { TimeSlotTemplate } from "./base/TimeSlotTemplate";
import { TimeSlotTemplateFindManyArgs } from "./base/TimeSlotTemplateFindManyArgs";
import { TimeSlotTemplateWhereUniqueInput } from "./base/TimeSlotTemplateWhereUniqueInput";
import { TimeSlotTemplateUpdateInput } from "./base/TimeSlotTemplateUpdateInput";
import {
  TimeSlotTemplateActionDto,
  TimeSlotTemplateAdminListQueryDto,
  TimeSlotTemplateAdminUpsertBodyDto,
} from "./dto/timeSlotTemplateAdmin.dto";

@swagger.ApiTags("timeSlotTemplates")
@common.Controller("timeSlotTemplates")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class TimeSlotTemplateController extends TimeSlotTemplateControllerBase {
  constructor(
    protected readonly service: TimeSlotTemplateService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }

  @common.Get("admin")
  async adminList(@common.Query() query: TimeSlotTemplateAdminListQueryDto) {
    return this.service.getAdminTimeSlotTemplates(query);
  }

  @common.Get("admin/active")
  async adminActive() {
    return this.service.getActiveTimeSlotTemplates();
  }

  @common.Get("admin/catalog")
  async adminCatalog() {
    return this.service.getTimeSlotCatalog();
  }

  @common.Post("admin/upsert")
  async adminUpsert(@common.Body() body: TimeSlotTemplateAdminUpsertBodyDto) {
    return this.service.upsertAdminTimeSlotTemplate(body);
  }

  @common.Post(":id/activate")
  async activate(
    @common.Param("id") id: string,
    @common.Body() body: TimeSlotTemplateActionDto
  ) {
    return this.service.activateTimeSlotTemplate({
      id,
      actorUserId: body.actorUserId ?? null,
    });
  }

  @common.Post(":id/deactivate")
  async deactivate(
    @common.Param("id") id: string,
    @common.Body() body: TimeSlotTemplateActionDto
  ) {
    return this.service.deactivateTimeSlotTemplate({
      id,
      actorUserId: body.actorUserId ?? null,
    });
  }
@common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: TimeSlotTemplate })
  @nestAccessControl.UseRoles({
    resource: "TimeSlotTemplate",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createTimeSlotTemplate(
    @common.Body() data: TimeSlotTemplateCreateInput
  ): Promise<TimeSlotTemplate> {
    return await this.service.createTimeSlotTemplate({
      data: data,
      select: {
        active: true,
        createdAt: true,
        endTime: true,
        id: true,
        label: true,
        startTime: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [TimeSlotTemplate] })
  @ApiNestedQuery(TimeSlotTemplateFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "TimeSlotTemplate",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async timeSlotTemplates(
    @common.Req() request: Request
  ): Promise<TimeSlotTemplate[]> {
    const args = plainToClass(TimeSlotTemplateFindManyArgs, request.query);
    return this.service.timeSlotTemplates({
      ...args,
      select: {
        active: true,
        createdAt: true,
        endTime: true,
        id: true,
        label: true,
        startTime: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: TimeSlotTemplate })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "TimeSlotTemplate",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async timeSlotTemplate(
    @common.Param() params: TimeSlotTemplateWhereUniqueInput
  ): Promise<TimeSlotTemplate | null> {
    const result = await this.service.timeSlotTemplate({
      where: params,
      select: {
        active: true,
        createdAt: true,
        endTime: true,
        id: true,
        label: true,
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
  @swagger.ApiOkResponse({ type: TimeSlotTemplate })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "TimeSlotTemplate",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateTimeSlotTemplate(
    @common.Param() params: TimeSlotTemplateWhereUniqueInput,
    @common.Body() data: TimeSlotTemplateUpdateInput
  ): Promise<TimeSlotTemplate | null> {
    try {
      return await this.service.updateTimeSlotTemplate({
        where: params,
        data: data,
        select: {
          active: true,
          createdAt: true,
          endTime: true,
          id: true,
          label: true,
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
  @swagger.ApiOkResponse({ type: TimeSlotTemplate })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "TimeSlotTemplate",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteTimeSlotTemplate(
    @common.Param() params: TimeSlotTemplateWhereUniqueInput
  ): Promise<TimeSlotTemplate | null> {
    try {
      return await this.service.deleteTimeSlotTemplate({
        where: params,
        select: {
          active: true,
          createdAt: true,
          endTime: true,
          id: true,
          label: true,
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

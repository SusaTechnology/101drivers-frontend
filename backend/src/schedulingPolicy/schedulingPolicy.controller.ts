import * as common from "@nestjs/common";
import * as swagger from "@nestjs/swagger";
import * as nestAccessControl from "nest-access-control";
import { SchedulingPolicyService } from "./schedulingPolicy.service";
import { SchedulingPolicyControllerBase } from "./base/schedulingPolicy.controller.base";
import { isRecordNotFoundError } from "../prisma.util";
import * as errors from "../errors";
import { Request } from "express";
import { plainToClass } from "class-transformer";
import { ApiNestedQuery } from "../decorators/api-nested-query.decorator";
import * as defaultAuthGuard from "../auth/defaultAuth.guard";
import { AclValidateRequestInterceptor } from "../interceptors/aclValidateRequest.interceptor";
import { AclFilterResponseInterceptor } from "../interceptors/aclFilterResponse.interceptor";
import { SchedulingPolicyCreateInput } from "./base/SchedulingPolicyCreateInput";
import { SchedulingPolicy } from "./base/SchedulingPolicy";
import { SchedulingPolicyFindManyArgs } from "./base/SchedulingPolicyFindManyArgs";
import { SchedulingPolicyWhereUniqueInput } from "./base/SchedulingPolicyWhereUniqueInput";
import { SchedulingPolicyUpdateInput } from "./base/SchedulingPolicyUpdateInput";
import {
  SchedulingPolicyActionDto,
  SchedulingPolicyAdminListQueryDto,
  SchedulingPolicyAdminUpsertBodyDto,
} from "./dto/schedulingPolicyAdmin.dto";
import {
  EnumSchedulingPolicyCustomerType,
  EnumSchedulingPolicyDefaultMode,
  EnumSchedulingPolicyServiceType,
} from "@prisma/client";
@swagger.ApiTags("schedulingPolicies")
@common.Controller("schedulingPolicies")
@swagger.ApiBearerAuth()
@common.UseGuards(defaultAuthGuard.DefaultAuthGuard, nestAccessControl.ACGuard)
export class SchedulingPolicyController extends SchedulingPolicyControllerBase {
  constructor(
    protected readonly service: SchedulingPolicyService,
    @nestAccessControl.InjectRolesBuilder()
    protected readonly rolesBuilder: nestAccessControl.RolesBuilder
  ) {
    super(service, rolesBuilder);
  }
@common.Get("admin")
async adminList(@common.Query() query: SchedulingPolicyAdminListQueryDto) {
  return this.service.getAdminSchedulingPolicies({
    active: query.active,
    customerType: query.customerType
      ? (query.customerType as EnumSchedulingPolicyCustomerType)
      : undefined,
    serviceType: query.serviceType
      ? (query.serviceType as EnumSchedulingPolicyServiceType)
      : undefined,
  });
}

@common.Post("admin/upsert")
async adminUpsert(
  @common.Body() body: SchedulingPolicyAdminUpsertBodyDto
) {
  return this.service.upsertAdminSchedulingPolicy({
    id: body.id ?? undefined,
    customerType: body.customerType
      ? (body.customerType as EnumSchedulingPolicyCustomerType)
      : undefined,
    serviceType: body.serviceType
      ? (body.serviceType as EnumSchedulingPolicyServiceType)
      : undefined,
    defaultMode: body.defaultMode as EnumSchedulingPolicyDefaultMode,
    sameDayCutoffTime: body.sameDayCutoffTime ?? undefined,
    maxSameDayMiles: body.maxSameDayMiles ?? undefined,
    bufferMinutes: body.bufferMinutes,
    afterHoursEnabled: body.afterHoursEnabled,
    requiresOpsConfirmation: body.requiresOpsConfirmation,
    active: body.active,
  });
}

@common.Get("admin/active")
async adminActive() {
  return this.service.getActiveSchedulingPolicies();
}

@common.Get("admin/summary")
async adminSummary() {
  return this.service.getSchedulingPolicySummary();
}

@common.Post(":id/activate")
async activate(
  @common.Param("id") id: string,
  @common.Body() body: SchedulingPolicyActionDto
) {
  return this.service.activateSchedulingPolicy({
    id,
    actorUserId: body.actorUserId ?? null,
  });
}

@common.Post(":id/deactivate")
async deactivate(
  @common.Param("id") id: string,
  @common.Body() body: SchedulingPolicyActionDto
) {
  return this.service.deactivateSchedulingPolicy({
    id,
    actorUserId: body.actorUserId ?? null,
  });
}  
@common.UseInterceptors(AclValidateRequestInterceptor)
  @common.Post()
  @swagger.ApiCreatedResponse({ type: SchedulingPolicy })
  @nestAccessControl.UseRoles({
    resource: "SchedulingPolicy",
    action: "create",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async createSchedulingPolicy(
    @common.Body() data: SchedulingPolicyCreateInput
  ): Promise<SchedulingPolicy> {
    return await this.service.createSchedulingPolicy({
      data: data,
      select: {
        active: true,
        afterHoursEnabled: true,
        bufferMinutes: true,
        createdAt: true,
        customerType: true,
        defaultMode: true,
        id: true,
        maxSameDayMiles: true,
        requiresOpsConfirmation: true,
        sameDayCutoffTime: true,
        serviceType: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get()
  @swagger.ApiOkResponse({ type: [SchedulingPolicy] })
  @ApiNestedQuery(SchedulingPolicyFindManyArgs)
  @nestAccessControl.UseRoles({
    resource: "SchedulingPolicy",
    action: "read",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async schedulingPolicies(
    @common.Req() request: Request
  ): Promise<SchedulingPolicy[]> {
    const args = plainToClass(SchedulingPolicyFindManyArgs, request.query);
    return this.service.schedulingPolicies({
      ...args,
      select: {
        active: true,
        afterHoursEnabled: true,
        bufferMinutes: true,
        createdAt: true,
        customerType: true,
        defaultMode: true,
        id: true,
        maxSameDayMiles: true,
        requiresOpsConfirmation: true,
        sameDayCutoffTime: true,
        serviceType: true,
        updatedAt: true,
      },
    });
  }

  @common.UseInterceptors(AclFilterResponseInterceptor)
  @common.Get("/:id")
  @swagger.ApiOkResponse({ type: SchedulingPolicy })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SchedulingPolicy",
    action: "read",
    possession: "own",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async schedulingPolicy(
    @common.Param() params: SchedulingPolicyWhereUniqueInput
  ): Promise<SchedulingPolicy | null> {
    const result = await this.service.schedulingPolicy({
      where: params,
      select: {
        active: true,
        afterHoursEnabled: true,
        bufferMinutes: true,
        createdAt: true,
        customerType: true,
        defaultMode: true,
        id: true,
        maxSameDayMiles: true,
        requiresOpsConfirmation: true,
        sameDayCutoffTime: true,
        serviceType: true,
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
  @swagger.ApiOkResponse({ type: SchedulingPolicy })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SchedulingPolicy",
    action: "update",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async updateSchedulingPolicy(
    @common.Param() params: SchedulingPolicyWhereUniqueInput,
    @common.Body() data: SchedulingPolicyUpdateInput
  ): Promise<SchedulingPolicy | null> {
    try {
      return await this.service.updateSchedulingPolicy({
        where: params,
        data: data,
        select: {
          active: true,
          afterHoursEnabled: true,
          bufferMinutes: true,
          createdAt: true,
          customerType: true,
          defaultMode: true,
          id: true,
          maxSameDayMiles: true,
          requiresOpsConfirmation: true,
          sameDayCutoffTime: true,
          serviceType: true,
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
  @swagger.ApiOkResponse({ type: SchedulingPolicy })
  @swagger.ApiNotFoundResponse({ type: errors.NotFoundException })
  @nestAccessControl.UseRoles({
    resource: "SchedulingPolicy",
    action: "delete",
    possession: "any",
  })
  @swagger.ApiForbiddenResponse({
    type: errors.ForbiddenException,
  })
  async deleteSchedulingPolicy(
    @common.Param() params: SchedulingPolicyWhereUniqueInput
  ): Promise<SchedulingPolicy | null> {
    try {
      return await this.service.deleteSchedulingPolicy({
        where: params,
        select: {
          active: true,
          afterHoursEnabled: true,
          bufferMinutes: true,
          createdAt: true,
          customerType: true,
          defaultMode: true,
          id: true,
          maxSameDayMiles: true,
          requiresOpsConfirmation: true,
          sameDayCutoffTime: true,
          serviceType: true,
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
